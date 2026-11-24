const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

// Optional API security
function checkApiKey(req, res, next) {
  const secret = process.env.API_SECRET;

  if (secret && req.headers["x-api-secret"] !== secret) {
    return res.status(401).json({
      status: false,
      message: "Unauthorized"
    });
  }

  next();
}

// Health check
app.get("/", (req, res) => {
  res.json({
    status: true,
    name: "DARK RAJA AUDIO API",
    message: "API is running"
  });
});

app.get("/health", (req, res) => {
  res.json({ status: true });
});

// Search YouTube metadata only
app.get("/api/search", checkApiKey, async (req, res) => {
  try {
    const query = req.query.q;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!query) {
      return res.status(400).json({
        status: false,
        message: "Song name required"
      });
    }

    if (!apiKey) {
      return res.status(500).json({
        status: false,
        message: "YouTube API key not configured"
      });
    }

    const url = new URL(
      "https://www.googleapis.com/youtube/v3/search"
    );

    url.search = new URLSearchParams({
      part: "snippet",
      q: query,
      type: "video",
      maxResults: "10",
      key: apiKey
    }).toString();

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        status: false,
        message: data.error?.message || "YouTube search failed"
      });
    }

    const results = (data.items || []).map(item => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      videoId: item.id.videoId,
      thumbnail: item.snippet.thumbnails?.high?.url || null,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));

    res.json({
      status: true,
      creator: "DARK RAJA",
      total: results.length,
      results
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: error.message
    });
  }
});

// Convert an authorized uploaded audio file to MP3
app.post(
  "/api/convert",
  checkApiKey,
  upload.single("audio"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        status: false,
        message: "Upload an audio file using field name: audio"
      });
    }

    const quality = String(req.query.quality || "128");

    if (!["128", "320"].includes(quality)) {
      return res.status(400).json({
        status: false,
        message: "Quality must be 128 or 320"
      });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="dark-raja-audio.mp3"'
    );

    const ffmpeg = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-vn",
      "-codec:a", "libmp3lame",
      "-b:a", `${quality}k`,
      "-f", "mp3",
      "pipe:1"
    ]);

    let finished = false;

    ffmpeg.on("error", () => {
      if (!res.headersSent) {
        res.status(500).json({
          status: false,
          message: "FFmpeg could not start"
        });
      } else {
        res.destroy();
      }
    });

    ffmpeg.stderr.on("data", data => {
      console.error("FFmpeg:", data.toString());
    });

    ffmpeg.on("close", code => {
      finished = true;
      if (code !== 0 && !res.destroyed) {
        res.destroy();
      }
    });

    req.on("aborted", () => ffmpeg.kill("SIGKILL"));

    ffmpeg.stdout.pipe(res);
    ffmpeg.stdin.end(req.file.buffer);

    res.on("close", () => {
      if (!finished) ffmpeg.kill("SIGKILL");
    });
  }
);

app.listen(PORT, () => {
  console.log(`DARK RAJA API running on port ${PORT}`);
});
