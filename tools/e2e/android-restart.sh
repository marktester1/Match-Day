#!/bin/bash
# GitHub only: start the Android emulator again after it has vanished mid-run (see android.yml), wait
# until it has booted, and set it up as the emulator runner did. The interrupted test then runs again.
set -e
echo "::warning::The Android emulator had gone: starting it again"
pkill -f qemu-system || true
rm -f "$ANDROID_AVD_HOME"/phone.avd/*.lock
nohup "$ANDROID_HOME/emulator/emulator" -avd phone -port 5554 -no-window -gpu swiftshader_indirect -no-snapshot -noaudio -no-boot-anim \
  > /tmp/emulator-restart.log 2>&1 &
timeout 300 adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ]; do sleep 2; done
for s in window_animation_scale transition_animation_scale animator_duration_scale; do adb shell settings put global $s 0; done
adb reverse tcp:8000 tcp:8000
echo "Emulator back"
