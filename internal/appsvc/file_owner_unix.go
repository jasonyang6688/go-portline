//go:build !windows

package appsvc

import (
	"os"
	"os/user"
	"strconv"
	"syscall"
)

func fileOwnerGroup(info os.FileInfo) (string, string) {
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok || stat == nil {
		return "", ""
	}

	uid := strconv.FormatUint(uint64(stat.Uid), 10)
	gid := strconv.FormatUint(uint64(stat.Gid), 10)
	owner := uid
	group := gid

	if foundUser, err := user.LookupId(uid); err == nil && foundUser.Username != "" {
		owner = foundUser.Username
	}
	if foundGroup, err := user.LookupGroupId(gid); err == nil && foundGroup.Name != "" {
		group = foundGroup.Name
	}

	return owner, group
}
