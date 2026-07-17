//go:build windows

package appsvc

import "os"

func fileOwnerGroup(os.FileInfo) (string, string) {
	return "", ""
}
