// RPG Forge desktop launcher: serves the embedded single-file editor on a
// fixed local port (so projects saved in the browser persist between runs)
// and opens it in the default browser.
package main

import (
	_ "embed"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"runtime"
)

//go:embed index.html
var page []byte

const addr = "127.0.0.1:47321"

func openBrowser(url string) {
	switch runtime.GOOS {
	case "windows":
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		exec.Command("open", url).Start()
	default:
		exec.Command("xdg-open", url).Start()
	}
}

func main() {
	url := "http://" + addr + "/"
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		// Already running: just open another window.
		openBrowser(url)
		return
	}
	fmt.Println("RPG Forge is running at", url)
	fmt.Println("Keep this window open while you work. Close it to quit.")
	openBrowser(url)
	http.Serve(ln, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.Write(page)
	}))
}
