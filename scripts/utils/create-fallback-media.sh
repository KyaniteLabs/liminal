#!/bin/bash
# Create fallback media for Remotion and Strudel

cd landing-assets

# Create a simple colored frames for Remotion
echo "Creating Remotion fallback video..."
mkdir -p temp-frames

# Generate 150 frames (5 seconds @ 30fps)
for i in $(seq -w 0 149); do
  # Create gradient background with text
  convert -size 1920x1080 \
    -background "#0a0a12" \
    -fill "hsl($((i * 2)), 70%, 60%)" \
    -gravity center \
    -pointsize 120 \
    -font Arial-Black \
    "label:SINTER" \
    -blur 0x5 \
    temp-frames/frame_$i.png 2>/dev/null || \
  echo "Frame $i" > temp-frames/frame_$i.txt
done

# Try to use ffmpeg with testsrc if imagemagick fails
ffmpeg -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 \
  -vf "format=yuv420p, drawtext=text='SINTER':fontfile=/System/Library/Fonts/Helvetica.ttc:fontsize=120:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" \
  -pix_fmt yuv420p dogfood-remotion-title.mp4 -y 2>/dev/null || \
echo "Video creation requires manual rendering"

# Cleanup
rm -rf temp-frames

echo "Done!"
