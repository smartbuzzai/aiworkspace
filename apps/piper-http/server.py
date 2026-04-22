"""Minimal HTTP TTS server wrapping piper-tts Python package."""

import io
import os
import wave
from flask import Flask, request, Response

app = Flask(__name__)
_voice = None


def get_voice():
    global _voice
    if _voice is None:
        from piper import PiperVoice
        model_dir = os.environ.get("PIPER_MODEL_DIR", "/data")
        voice_name = os.environ.get("PIPER_VOICE", "en_US-lessac-medium")
        model_path = f"{model_dir}/{voice_name}.onnx"

        if not os.path.exists(model_path):
            # Download model on first use via CLI
            import subprocess
            subprocess.run(
                ["piper", "--model", voice_name, "--data-dir", model_dir,
                 "--download-dir", model_dir, "--output-raw"],
                input=b"warmup", capture_output=True, timeout=120,
            )

        _voice = PiperVoice.load(model_path)
        print(f"Loaded voice: {voice_name} (sample_rate={_voice.config.sample_rate})")
    return _voice


@app.route("/api/tts")
def tts():
    text = request.args.get("text", "")
    if not text or len(text) > 5000:
        return "text parameter required (max 5000)", 400

    voice = get_voice()
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(voice.config.sample_rate)
        voice.synthesize_wav(text, wf)

    return Response(buf.getvalue(), mimetype="audio/wav")


@app.route("/health")
def health():
    return "ok"


if __name__ == "__main__":
    print("Loading TTS model...")
    get_voice()
    print("Ready")
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), threaded=True)
