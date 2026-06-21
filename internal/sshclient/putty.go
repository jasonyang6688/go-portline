package sshclient

import (
	"bufio"
	"crypto/rsa"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"math/big"
	"strings"

	gossh "golang.org/x/crypto/ssh"
)

var errNotPuttyPrivateKey = errors.New("not a PuTTY private key")

type puttyPrivateKey struct {
	algorithm      string
	encryption     string
	publicBlob     []byte
	privateBlob    []byte
	hasPuttyHeader bool
}

func parsePuTTYPrivateKey(key []byte) (gossh.Signer, error) {
	parsed, err := readPuttyPrivateKey(key)
	if err != nil {
		return nil, err
	}
	if !parsed.hasPuttyHeader {
		return nil, errNotPuttyPrivateKey
	}
	if parsed.encryption != "none" {
		return nil, fmt.Errorf("encrypted PuTTY private keys are not supported; convert the .ppk to OpenSSH format first")
	}
	if parsed.algorithm != "ssh-rsa" {
		return nil, fmt.Errorf("unsupported PuTTY private key algorithm %q", parsed.algorithm)
	}

	rsaKey, err := parsed.rsaPrivateKey()
	if err != nil {
		return nil, err
	}
	if err := rsaKey.Validate(); err != nil {
		return nil, fmt.Errorf("invalid PuTTY RSA private key: %w", err)
	}
	rsaKey.Precompute()

	return gossh.NewSignerFromKey(rsaKey)
}

func readPuttyPrivateKey(key []byte) (puttyPrivateKey, error) {
	scanner := bufio.NewScanner(strings.NewReader(string(key)))
	var out puttyPrivateKey

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		switch {
		case strings.HasPrefix(line, "PuTTY-User-Key-File-"):
			_, value, ok := strings.Cut(line, ":")
			if !ok {
				return puttyPrivateKey{}, errors.New("invalid PuTTY private key header")
			}
			out.algorithm = strings.TrimSpace(value)
			out.hasPuttyHeader = true
		case strings.HasPrefix(line, "Encryption:"):
			out.encryption = headerValue(line)
		case strings.HasPrefix(line, "Public-Lines:"):
			blob, err := readPuttyBase64Block(scanner, headerValue(line))
			if err != nil {
				return puttyPrivateKey{}, fmt.Errorf("read PuTTY public key block: %w", err)
			}
			out.publicBlob = blob
		case strings.HasPrefix(line, "Private-Lines:"):
			blob, err := readPuttyBase64Block(scanner, headerValue(line))
			if err != nil {
				return puttyPrivateKey{}, fmt.Errorf("read PuTTY private key block: %w", err)
			}
			out.privateBlob = blob
		}
	}
	if err := scanner.Err(); err != nil {
		return puttyPrivateKey{}, err
	}
	if !out.hasPuttyHeader {
		return out, nil
	}
	if out.encryption == "" {
		return puttyPrivateKey{}, errors.New("PuTTY private key is missing Encryption header")
	}
	if len(out.publicBlob) == 0 || len(out.privateBlob) == 0 {
		return puttyPrivateKey{}, errors.New("PuTTY private key is missing key data")
	}

	return out, nil
}

func headerValue(line string) string {
	_, value, ok := strings.Cut(line, ":")
	if !ok {
		return ""
	}
	return strings.TrimSpace(value)
}

func readPuttyBase64Block(scanner *bufio.Scanner, countText string) ([]byte, error) {
	var count int
	if _, err := fmt.Sscanf(countText, "%d", &count); err != nil {
		return nil, err
	}
	if count < 0 {
		return nil, errors.New("negative line count")
	}

	var encoded strings.Builder
	for i := 0; i < count; i++ {
		if !scanner.Scan() {
			return nil, errors.New("unexpected end of PuTTY key block")
		}
		encoded.WriteString(strings.TrimSpace(scanner.Text()))
	}

	return base64.StdEncoding.DecodeString(encoded.String())
}

func (k puttyPrivateKey) rsaPrivateKey() (*rsa.PrivateKey, error) {
	publicReader := sshBlobReader{data: k.publicBlob}
	name, err := publicReader.stringValue()
	if err != nil {
		return nil, err
	}
	if string(name) != "ssh-rsa" {
		return nil, fmt.Errorf("PuTTY public key blob algorithm = %q", string(name))
	}
	e, err := publicReader.mpint()
	if err != nil {
		return nil, err
	}
	n, err := publicReader.mpint()
	if err != nil {
		return nil, err
	}
	if !e.IsInt64() || e.Int64() <= 0 || e.Int64() > math.MaxInt {
		return nil, errors.New("PuTTY RSA public exponent is out of range")
	}

	privateReader := sshBlobReader{data: k.privateBlob}
	d, err := privateReader.mpint()
	if err != nil {
		return nil, err
	}
	p, err := privateReader.mpint()
	if err != nil {
		return nil, err
	}
	q, err := privateReader.mpint()
	if err != nil {
		return nil, err
	}
	if _, err := privateReader.mpint(); err != nil {
		return nil, err
	}

	return &rsa.PrivateKey{
		PublicKey: rsa.PublicKey{
			N: n,
			E: int(e.Int64()),
		},
		D:      d,
		Primes: []*big.Int{p, q},
	}, nil
}

type sshBlobReader struct {
	data []byte
}

func (r *sshBlobReader) take(n uint32) ([]byte, error) {
	if uint32(len(r.data)) < n {
		return nil, errors.New("short SSH blob")
	}
	value := r.data[:n]
	r.data = r.data[n:]
	return value, nil
}

func (r *sshBlobReader) stringValue() ([]byte, error) {
	if len(r.data) < 4 {
		return nil, errors.New("short SSH string")
	}
	n := binary.BigEndian.Uint32(r.data[:4])
	r.data = r.data[4:]
	return r.take(n)
}

func (r *sshBlobReader) mpint() (*big.Int, error) {
	value, err := r.stringValue()
	if err != nil {
		return nil, err
	}
	return new(big.Int).SetBytes(value), nil
}
