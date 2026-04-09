package app

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"os"
	"strings"
)

// KittyGraphicsSupported checks if the terminal advertises Kitty graphics protocol.
func KittyGraphicsSupported() bool {
	term := os.Getenv("TERM")
	if strings.Contains(term, "kitty") || strings.Contains(term, "xterm-kitty") {
		return true
	}
	if os.Getenv("KITTY_WINDOW_ID") != "" {
		return true
	}
	// Ghostty supports Kitty graphics protocol
	if os.Getenv("GHOSTTY_RESOURCES_DIR") != "" {
		return true
	}
	return false
}

// RenderKittyImage encodes an image as a Kitty graphics protocol escape sequence.
// Uses raw RGB format (f=24) which avoids needing a PNG encoder.
func RenderKittyImage(img image.Image, width int) string {
	var sb strings.Builder

	// Convert image to raw RGB bytes
	rgbData := imageToRGB(img)
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	b64Data := base64.StdEncoding.EncodeToString(rgbData)

	// Kitty graphics: transmit in 4096-byte base64 chunks
	chunkSize := 4096
	totalChunks := (len(b64Data) + chunkSize - 1) / chunkSize

	for i := 0; i < totalChunks; i++ {
		start := i * chunkSize
		end := start + chunkSize
		if end > len(b64Data) {
			end = len(b64Data)
		}
		chunk := b64Data[start:end]

		more := 0
		if i < totalChunks-1 {
			more = 1
		}

		if i == 0 {
			// a=T (transmit+display), f=24 (RGB), s=width, v=height, C=1 (auto-zoom)
			sb.WriteString(fmt.Sprintf("\x1b_Ga=T,f=24,s=%d,v=%d,C=1,m=%d;%s\x1b\\", w, h, more, chunk))
		} else {
			sb.WriteString(fmt.Sprintf("\x1b_Gm=%d;%s\x1b\\", more, chunk))
		}
	}

	return sb.String()
}

// RenderHalfblockImage renders an image using Unicode halfblock characters (▀).
// Each cell represents 2 vertical pixels: foreground=top pixel, background=bottom pixel.
func RenderHalfblockImage(img image.Image, width int) string {
	bounds := img.Bounds()
	imgW := bounds.Dx()
	imgH := bounds.Dy()

	if imgW == 0 || imgH == 0 {
		return "(empty image)"
	}

	// Scale to fit width
	scale := float64(width) / float64(imgW)
	if scale > 1 {
		scale = 1
	}
	scaledW := int(float64(imgW) * scale)
	scaledH := int(float64(imgH) * scale)

	if scaledH%2 != 0 {
		scaledH++
	}

	var sb strings.Builder
	for y := 0; y < scaledH; y += 2 {
		for x := 0; x < scaledW; x++ {
			srcX := clampInt(int(float64(x)/scale), 0, imgW-1)
			srcY1 := clampInt(int(float64(y)/scale), 0, imgH-1)
			srcY2 := clampInt(int(float64(y+1)/scale), 0, imgH-1)

			top := colorAt(img, srcX, srcY1)
			bot := colorAt(img, srcX, srcY2)

			sb.WriteString(fmt.Sprintf(
				"\x1b[38;2;%d;%d;%dm\x1b[48;2;%d;%d;%dm▀",
				top.R, top.G, top.B,
				bot.R, bot.G, bot.B,
			))
		}
		sb.WriteString("\x1b[0m\n")
	}

	return sb.String()
}

// RenderImage renders an image for terminal display, using Kitty protocol if available.
func RenderImage(img image.Image, width int) string {
	if KittyGraphicsSupported() {
		return RenderKittyImage(img, width)
	}
	return RenderHalfblockImage(img, width)
}

// RenderImageFromBase64 decodes a base64-encoded image and renders it for terminal display.
func RenderImageFromBase64(b64Data string, width int) string {
	data, err := base64.StdEncoding.DecodeString(b64Data)
	if err != nil {
		return fmt.Sprintf("(image decode error: %s)", err)
	}

	img, err := decodeImage(data)
	if err != nil {
		return fmt.Sprintf("(image parse error: %s)", err)
	}

	return RenderImage(img, width)
}

// ── Internal helpers ──

type rgb struct {
	R, G, B uint8
}

func colorAt(img image.Image, x, y int) rgb {
	r, g, b, _ := img.At(x, y).RGBA()
	return rgb{R: uint8(r >> 8), G: uint8(g >> 8), B: uint8(b >> 8)}
}

func imageToRGB(img image.Image) []byte {
	bounds := img.Bounds()
	data := make([]byte, 0, bounds.Dx()*bounds.Dy()*3)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			data = append(data, uint8(r>>8), uint8(g>>8), uint8(b>>8))
		}
	}
	return data
}

func decodeImage(data []byte) (image.Image, error) {
	reader := bytes.NewReader(data)

	// Try PNG first (most common for generated images)
	if img, err := png.Decode(reader); err == nil {
		return img, nil
	}
	reader.Seek(0, 0)

	// Try JPEG
	if img, err := jpeg.Decode(reader); err == nil {
		return img, nil
	}
	reader.Seek(0, 0)

	// Try GIF
	if img, err := gif.Decode(reader); err == nil {
		return img, nil
	}

	// Try generic decode as last resort
	reader.Seek(0, 0)
	img, _, err := image.Decode(reader)
	if err != nil {
		return nil, fmt.Errorf("unsupported image format")
	}
	return img, nil
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

// Ensure color import is used
var _ color.RGBA
