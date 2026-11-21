#!/usr/bin/env python3
"""Shorts helper. Runs only on your own computer (127.0.0.1).
Needs: python3, yt-dlp, ffmpeg (with libass), and a Bangla font (Noto Sans Bengali or Hind Siliguri).
Start:  python server.py
"""
import json, os, re, shutil, subprocess, sys, tempfile, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
os.makedirs(OUT, exist_ok=True)
PORT = int(os.environ.get("PORT", "8787"))
FONT = os.environ.get("CAPTION_FONT", "Noto Sans Bengali")
FONTS_DIR = os.environ.get("FONTS_DIR", "")
ALLOWED = [o.strip() for o in os.environ.get(
    "ALLOWED_ORIGINS", "https://shishir.qd.je,http://localhost,http://127.0.0.1,null").split(",") if o.strip()]
URL_OK = re.compile(r"^https?://(www\.|m\.)?(youtube\.com|youtu\.be)/", re.I)
W, H = 1080, 1920


def run(cmd, cwd=None):
    p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout or "command failed").strip()[-600:])
    return p.stdout


def probe(path):
    out = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
               "stream=width,height", "-of", "csv=p=0", path]).strip().split(",")
    return int(out[0]), int(out[1])


def region(vw, vh, px, py, pw, ar):
    """Same maths as the web preview: px,py are percent of the free space, pw is percent of video width."""
    w = vw * pw / 100.0
    h = w / ar
    if h > vh:
        h = vh
        w = h * ar
    w, h = int(w) // 2 * 2, int(h) // 2 * 2
    return w, h, int((vw - w) * px / 100.0) // 2 * 2, int((vh - h) * py / 100.0) // 2 * 2


def ass_time(s):
    s = max(0.0, float(s))
    return "%d:%02d:%05.2f" % (int(s // 3600), int(s % 3600 // 60), s % 60)


def make_ass(caps, L, path):
    size = int(L["csz"])
    y = int(H * float(L["cpos"]) / 100.0)
    lines = [
        "[Script Info]", "ScriptType: v4.00+", "PlayResX: 1080", "PlayResY: 1920", "WrapStyle: 0", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, "
        "Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, "
        "MarginR, MarginV, Encoding",
        "Style: Cap,%s,%d,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,%d,2,5,70,70,0,1"
        % (FONT, size, max(3, size // 9)), "",
        "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
    for c in caps:
        t = str(c.get("t", "")).replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", "\\N").strip()
        if t:
            lines.append("Dialogue: 0,%s,%s,Cap,,0,0,0,,{\\pos(540,%d)}%s" % (ass_time(c["s"]), ass_time(c["e"]), y, t))
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def compose(src, out, L, caps, workdir):
    vw, vh = probe(src)
    fh = int(round(H * float(L["split"]) / 100.0)) // 2 * 2
    fw_, fh_, fx, fy = region(vw, vh, float(L["fx"]), float(L["fy"]), float(L["fw"]), W / fh)
    gw_, gh_, gx, gy = region(vw, vh, float(L["gx"]), float(L["gy"]), float(L["gw"]), W / (H - fh))
    make_ass(caps, L, os.path.join(workdir, "caps.ass"))
    sub = "subtitles=caps.ass" + (":fontsdir=%s" % FONTS_DIR if FONTS_DIR else "")
    fc = ("[0:v]split=2[a][b];"
          "[a]crop=%d:%d:%d:%d,scale=%d:%d[f];"
          "[b]crop=%d:%d:%d:%d,scale=%d:%d[g];"
          "[f][g]vstack=inputs=2,%s[v]") % (fw_, fh_, fx, fy, W, fh, gw_, gh_, gx, gy, W, H - fh, sub)
    run(["ffmpeg", "-y", "-i", src, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30",
         "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], cwd=workdir)


def download(url, start, end, workdir):
    run(["yt-dlp", "-f", "bv*[height<=1080]+ba/b[height<=1080]/b", "--download-sections", "*%.2f-%.2f" % (start, end),
         "--force-keyframes-at-cuts", "--merge-output-format", "mp4", "--no-playlist",
         "-o", os.path.join(workdir, "src.%(ext)s"), url])
    for f in os.listdir(workdir):
        if f.startswith("src."):
            return os.path.join(workdir, f)
    raise RuntimeError("yt-dlp did not produce a file")


def render(data):
    url = str(data.get("url", ""))
    if not URL_OK.match(url):
        raise ValueError("Only YouTube links are allowed")
    start, end = float(data["start"]), float(data["end"])
    if not (0 <= start < end <= start + 90):
        raise ValueError("Bad time range (max 90 seconds)")
    L = data["layout"]
    caps = [{"s": float(c["s"]), "e": float(c["e"]), "t": c["t"]} for c in data.get("captions", [])]
    tmp = tempfile.mkdtemp(prefix="short_")
    try:
        src = download(url, start, end, tmp)
        name = "short_%s_%s.mp4" % (time.strftime("%Y%m%d_%H%M%S"), uuid.uuid4().hex[:4])
        compose(src, os.path.join(OUT, name), L, caps, tmp)
        return name
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        o = self.headers.get("Origin", "")
        if o in ALLOWED or any(o.startswith(a + ":") for a in ALLOWED if a.startswith("http://")):
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True, "ytdlp": bool(shutil.which("yt-dlp")), "ffmpeg": bool(shutil.which("ffmpeg"))})
        if self.path.startswith("/files/"):
            p = os.path.join(OUT, os.path.basename(self.path[7:].split("?")[0]))
            if os.path.isfile(p):
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "video/mp4")
                self.send_header("Content-Length", str(os.path.getsize(p)))
                self.send_header("Content-Disposition", 'attachment; filename="%s"' % os.path.basename(p))
                self.end_headers()
                with open(p, "rb") as f:
                    shutil.copyfileobj(f, self.wfile)
                return
        self._json(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        if self.path != "/render":
            return self._json(404, {"ok": False, "error": "not found"})
        try:
            data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            name = render(data)
            self._json(200, {"ok": True, "file": name, "url": "/files/" + name})
        except Exception as e:
            self._json(400, {"ok": False, "error": str(e)[:500]})

    def log_message(self, fmt, *a):
        sys.stderr.write("[helper] " + fmt % a + "\n")


if __name__ == "__main__":
    print("Shorts helper running on http://127.0.0.1:%d  (videos are saved in %s)" % (PORT, OUT))
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
