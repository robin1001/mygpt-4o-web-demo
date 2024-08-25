# MyGPT-4o

MyGPT-4o, gpt-4o like web demo.

## Install(TODO)

## Run

1. Start server

``` bash
$ python server/server.py
```

2. Start frontend

First change `SERVER_URL` to your server url in `frontend/src/components/Session/index.tsx`, then

``` bash
$ cd frontend
$ yarn run dev
```

## System Overview

* `frontend`: react based web frontend.
* `server`: python websocket server.

## Acknowledgement

This project is based on https://github.com/rtvi-ai/rtvi-web-demo.
