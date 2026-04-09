package app

import (
	"image"
	"image/color"
	"os"
	"strings"
	"testing"
)

func TestKittyGraphicsSupportedKitty(t *testing.T) {
	os.Setenv("TERM", "xterm-kitty")
	defer os.Unsetenv("TERM")

	if !KittyGraphicsSupported() {
		t.Fatal("expected Kitty support with TERM=xterm-kitty")
	}
}

func TestKittyGraphicsSupportedGhostty(t *testing.T) {
	os.Setenv("GHOSTTY_RESOURCES_DIR", "/opt/ghostty")
	defer os.Unsetenv("GHOSTTY_RESOURCES_DIR")

	if !KittyGraphicsSupported() {
		t.Fatal("expected Kitty support with GHOSTTY_RESOURCES_DIR set")
	}
}

func TestKittyGraphicsNotSupported(t *testing.T) {
	os.Setenv("TERM", "xterm-256color")
	defer os.Unsetenv("TERM")
	os.Unsetenv("KITTY_WINDOW_ID")
	os.Unsetenv("GHOSTTY_RESOURCES_DIR")

	if KittyGraphicsSupported() {
		t.Fatal("expected no Kitty support with generic terminal")
	}
}

func TestRenderHalfblockImage(t *testing.T) {
	// Create a 4x4 red image
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			img.Set(x, y, color.RGBA{255, 0, 0, 255})
		}
	}

	result := RenderHalfblockImage(img, 4)
	if !strings.Contains(result, "▀") {
		t.Fatal("expected halfblock characters in output")
	}
	if !strings.Contains(result, "\x1b[38;2;255;0;0m") {
		t.Fatal("expected red foreground color in output")
	}
}

func TestRenderHalfblockImageEmpty(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 0, 0))
	result := RenderHalfblockImage(img, 10)
	if result != "(empty image)" {
		t.Fatalf("expected empty image message, got %q", result)
	}
}

func TestRenderImageFallsBackToHalfblock(t *testing.T) {
	os.Setenv("TERM", "xterm-256color")
	defer os.Unsetenv("TERM")
	os.Unsetenv("KITTY_WINDOW_ID")
	os.Unsetenv("GHOSTTY_RESOURCES_DIR")

	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{0, 255, 0, 255})

	result := RenderImage(img, 2)
	if !strings.Contains(result, "▀") {
		t.Fatal("expected halfblock fallback")
	}
}

func TestRenderImageFromBase64Invalid(t *testing.T) {
	result := RenderImageFromBase64("not-valid-base64!!!", 10)
	if !strings.Contains(result, "(image decode error:") {
		t.Fatalf("expected decode error, got %q", result)
	}
}

func TestRenderImageFromBase64InvalidImage(t *testing.T) {
	// Valid base64 but not a valid image
	result := RenderImageFromBase64("aGVsbG8gd29ybGQ=", 10)
	if !strings.Contains(result, "(image parse error:") {
		t.Fatalf("expected parse error, got %q", result)
	}
}

func TestClampInt(t *testing.T) {
	tests := []struct {
		v, lo, hi, want int
	}{
		{5, 0, 10, 5},
		{-1, 0, 10, 0},
		{15, 0, 10, 10},
		{0, 0, 0, 0},
	}
	for _, tt := range tests {
		got := clampInt(tt.v, tt.lo, tt.hi)
		if got != tt.want {
			t.Errorf("clampInt(%d, %d, %d) = %d, want %d", tt.v, tt.lo, tt.hi, got, tt.want)
		}
	}
}

func TestColorAt(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.RGBA{128, 64, 32, 255})

	c := colorAt(img, 0, 0)
	if c.R != 128 || c.G != 64 || c.B != 32 {
		t.Fatalf("expected rgb{128,64,32}, got %+v", c)
	}
}
