package storage

import (
	"context"
	"net/url"
	"strconv"

	"github.com/redis/go-redis/v9"
)

func OpenRedis(ctx context.Context, redisURL string) (*redis.Client, error) {
	parsed, err := url.Parse(redisURL)
	if err != nil {
		return nil, err
	}
	db := 0
	if parsed.Path != "" && parsed.Path != "/" {
		db, err = strconv.Atoi(parsed.Path[1:])
		if err != nil {
			return nil, err
		}
	}
	opts := &redis.Options{
		Addr: parsed.Host,
		DB:   db,
	}
	if parsed.User != nil {
		opts.Username = parsed.User.Username()
		if password, ok := parsed.User.Password(); ok {
			opts.Password = password
		}
	}
	client := redis.NewClient(opts)
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, err
	}
	return client, nil
}
