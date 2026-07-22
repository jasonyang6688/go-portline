package sshclient

import "time"

const (
	terminalKeepaliveInterval = 30 * time.Second
	terminalKeepaliveTimeout  = 10 * time.Second
	terminalKeepaliveRequest  = "keepalive@openssh.com"
)

type keepaliveClient interface {
	SendRequest(name string, wantReply bool, payload []byte) (bool, []byte, error)
	Close() error
}

func keepSSHConnectionAlive(client keepaliveClient, stop <-chan struct{}) {
	ticker := time.NewTicker(terminalKeepaliveInterval)
	defer ticker.Stop()
	runKeepalives(client, stop, ticker.C, terminalKeepaliveTimeout)
}

func runKeepalives(client keepaliveClient, stop <-chan struct{}, ticks <-chan time.Time, probeTimeout time.Duration) {
	for {
		select {
		case <-stop:
			return
		case _, ok := <-ticks:
			if !ok {
				return
			}
		}

		result := make(chan error, 1)
		go func() {
			_, _, err := client.SendRequest(terminalKeepaliveRequest, true, nil)
			result <- err
		}()

		timer := time.NewTimer(probeTimeout)
		select {
		case <-stop:
			stopTimer(timer)
			return
		case err := <-result:
			stopTimer(timer)
			if err != nil {
				_ = client.Close()
				return
			}
		case <-timer.C:
			_ = client.Close()
			return
		}
	}
}

func stopTimer(timer *time.Timer) {
	if timer.Stop() {
		return
	}
	select {
	case <-timer.C:
	default:
	}
}
