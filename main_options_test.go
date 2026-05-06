package main

import "testing"

func TestBuildAppOptionsEnablesMacZoomButton(t *testing.T) {
	opts := buildAppOptions(NewApp())

	if opts.Mac == nil {
		t.Fatal("expected mac options to be configured")
	}
	if opts.Mac.DisableZoom {
		t.Fatal("expected mac zoom/fullscreen button to be enabled")
	}
}
