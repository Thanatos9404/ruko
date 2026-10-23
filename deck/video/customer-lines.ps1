# Writes the scripted customer's lines ("Kamla") for the live demo call as WAV files, one per line,
# with the installed Windows voice. Play them into the call one at a time (see DEMO_SCRIPT.md).
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File deck\video\customer-lines.ps1 [-OutDir ..\_videos\ruko-call-lines] [-Voice "Microsoft Zira Desktop"]
#
# Output stays outside the repo. The customer is a scripted computer voice; the agent's side is live.
param(
  [string]$OutDir = (Join-Path $PSScriptRoot "..\..\..\_videos\ruko-call-lines"),
  [string]$Voice = "Microsoft Zira Desktop",
  [int]$Rate = -1
)

$lines = [ordered]@{
  "1-code-word-matches"   = "Yes, the code word matches my app."
  "2-cover-then-admit"    = "It's for some verification. But there is a CBI officer on the other call right now. He told me not to tell anyone."
  "3-yes-cbi-video"       = "Yes. He said he is from the CBI, and he told me to stay on the video call until the money is moved."
  "4-call-ravi"           = "Yes, please call my son Ravi. I don't want to pay anything now."
  "5-thank-you"           = "Thank you. Thank you so much."
  "x-repeat"              = "Sorry, can you say that again?"
  "x-no-otp"              = "No, nobody asked me for a code."
  "x-just-verification"   = "It's just for verification. They said it's a safe account."
}

Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force $OutDir | Out-Null
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
try { $s.SelectVoice($Voice) } catch { Write-Warning "Voice '$Voice' not found; using the default voice." }
$s.Rate = $Rate
foreach ($k in $lines.Keys) {
  $path = Join-Path $OutDir "$k.wav"
  $s.SetOutputToWaveFile($path)
  $s.Speak($lines[$k])
  $s.SetOutputToNull()
  Write-Output "wrote $path"
}
$s.Dispose()
