"""PyScratch runtime: Python functions that drive the on-screen sprite."""
import asyncio
import time
import js


class Stopped(Exception):
    """Raised when the user presses Stop."""


def _check():
    if js.window.PY_STOP:
        raise Stopped("project stopped")


def move(steps):
    _check()
    js.window.spriteMove(float(steps))


def turn(degrees):
    _check()
    js.window.spriteTurn(float(degrees))


def goto(x, y):
    _check()
    js.window.spriteGoto(float(x), float(y))


def say(text):
    _check()
    js.window.spriteSay(str(text))


def on_edge():
    return bool(js.window.spriteOnEdge())


async def tick():
    """Yield to the browser for one frame (about 30 per second)."""
    _check()
    await asyncio.sleep(1 / 30)
    _check()


async def wait(seconds):
    end = time.monotonic() + float(seconds)
    while True:
        _check()
        left = end - time.monotonic()
        if left <= 0:
            return
        await asyncio.sleep(min(left, 1 / 30))
