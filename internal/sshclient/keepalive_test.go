package sshclient

import (
	"errors"
	"testing"
	"time"
)

type keepaliveRequest struct {
	name      string
	wantReply bool
	payload   []byte
}

type fakeKeepaliveClient struct {
	requests  chan keepaliveRequest
	closeCall chan struct{}
	sendErr   error
}

func (f *fakeKeepaliveClient) SendRequest(name string, wantReply bool, payload []byte) (bool, []byte, error) {
	f.requests <- keepaliveRequest{name: name, wantReply: wantReply, payload: payload}
	return false, nil, f.sendErr
}

func (f *fakeKeepaliveClient) Close() error {
	select {
	case f.closeCall <- struct{}{}:
	default:
	}
	return nil
}

func TestRunKeepalivesSendsOpenSSHRequestUntilStopped(t *testing.T) {
	client := &fakeKeepaliveClient{
		requests:  make(chan keepaliveRequest, 2),
		closeCall: make(chan struct{}, 1),
	}
	ticks := make(chan time.Time, 2)
	stop := make(chan struct{})
	done := make(chan struct{})
	go func() {
		runKeepalives(client, stop, ticks, time.Second)
		close(done)
	}()

	for range 2 {
		ticks <- time.Now()
		select {
		case request := <-client.requests:
			if request.name != "keepalive@openssh.com" || !request.wantReply || request.payload != nil {
				t.Fatalf("keepalive request = %#v, want OpenSSH request with reply and no payload", request)
			}
		case <-time.After(time.Second):
			t.Fatal("runKeepalives() did not send a keepalive request")
		}
	}

	close(stop)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("runKeepalives() did not stop")
	}
	select {
	case <-client.closeCall:
		t.Fatal("runKeepalives() closed a healthy client")
	default:
	}
}

func TestRunKeepalivesClosesClientAfterSendFailure(t *testing.T) {
	client := &fakeKeepaliveClient{
		requests:  make(chan keepaliveRequest, 1),
		closeCall: make(chan struct{}, 1),
		sendErr:   errors.New("connection lost"),
	}
	ticks := make(chan time.Time, 1)
	done := make(chan struct{})
	go func() {
		runKeepalives(client, make(chan struct{}), ticks, time.Second)
		close(done)
	}()

	ticks <- time.Now()
	select {
	case <-client.closeCall:
	case <-time.After(time.Second):
		t.Fatal("runKeepalives() did not close the failed client")
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("runKeepalives() did not stop after send failure")
	}
}

func TestRunKeepalivesClosesClientAfterProbeTimeout(t *testing.T) {
	client := newBlockingKeepaliveClient()
	ticks := make(chan time.Time, 1)
	done := make(chan struct{})
	go func() {
		runKeepalives(client, make(chan struct{}), ticks, 10*time.Millisecond)
		close(done)
	}()

	ticks <- time.Now()
	select {
	case <-client.closeCall:
	case <-time.After(time.Second):
		t.Fatal("runKeepalives() did not close the timed-out client")
	}
	select {
	case <-client.sendDone:
	case <-time.After(time.Second):
		t.Fatal("client.Close() did not release the blocked keepalive request")
	}
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("runKeepalives() did not stop after probe timeout")
	}
}

type blockingKeepaliveClient struct {
	requests  chan keepaliveRequest
	closeCall chan struct{}
	closed    chan struct{}
	sendDone  chan struct{}
}

func newBlockingKeepaliveClient() *blockingKeepaliveClient {
	return &blockingKeepaliveClient{
		requests:  make(chan keepaliveRequest, 1),
		closeCall: make(chan struct{}, 1),
		closed:    make(chan struct{}),
		sendDone:  make(chan struct{}),
	}
}

func (c *blockingKeepaliveClient) SendRequest(name string, wantReply bool, payload []byte) (bool, []byte, error) {
	defer close(c.sendDone)
	c.requests <- keepaliveRequest{name: name, wantReply: wantReply, payload: payload}
	<-c.closed
	return false, nil, errors.New("client closed")
}

func (c *blockingKeepaliveClient) Close() error {
	select {
	case c.closeCall <- struct{}{}:
	default:
	}
	close(c.closed)
	return nil
}
