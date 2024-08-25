import json

import tornado.ioloop
import tornado.web
import tornado.websocket


class WebSocketHandler(tornado.websocket.WebSocketHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.audio = b''

    def check_origin(self, origin):
        return True

    def open(self):
        print("WebSocket opened")

    # def on_message(self, message):
    #     print(type(message))
    #     self.audio += message
    #     self.write_message(message, isinstance(message, bytes))
    #     print('Total size', len(self.audio))

    def on_message(self, message):
        print(type(message))
        from pydub import AudioSegment
        import time
        audio = AudioSegment.from_file("test.opus")
        frame_duration = 2000
        for start in range(0, len(audio), frame_duration):
            frame = audio[start:start + frame_duration]
            opus_bytes = frame.export(format='opus').read()
            self.write_message(opus_bytes, True)
            time.sleep(1)

    def on_close(self):
        print("WebSocket closed")
        # with open('test.opus', 'wb') as f:
        #     f.write(self.audio)


class MainHandler(tornado.web.RequestHandler):

    def set_default_headers(self):
        self.set_header('Access-Control-Allow-Origin', '*')
        self.set_header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
        self.set_header('Access-Control-Allow-Headers', 'Content-Type')

    def get(self):
        print(f"GET 请求参数：{self.request.arguments}")
        self.write("Hello, Tornado!")

    def post(self):
        print(f"POST 请求参数：{self.request.arguments}")
        data = json.loads(self.request.body)
        print(data)
        self.write("Hello, Tornado!")


def make_app():
    return tornado.web.Application([
        (r"/chat", WebSocketHandler),
        (r"/", MainHandler),
    ])


if __name__ == "__main__":
    app = make_app()
    app.listen(8888)
    tornado.ioloop.IOLoop.current().start()
