import { Logger } from '@nestjs/common';
import morgan from 'morgan';

export const morganLogger = (logger: Logger) => {
  return morgan(
    (tokens, req, res) => {
      const status = res.statusCode;
      const color =
        status >= 500
          ? 31 // red
          : status >= 400
            ? 33 // yellow
            : status >= 300
              ? 36 // cyan
              : status >= 200
                ? 32 // green
                : 0; // no color

      return [
        `\x1b[0m${tokens.method?.(req, res)}`,
        `${tokens.url?.(req, res)} \x1b[` + color + `m${tokens.status?.(req, res)}\x1b[0m`,
        `${tokens['response-time']?.(req, res)} ms - ${tokens['remote-addr']?.(req, res)}\x1b[0m`,
        // @ts-expect-error why?
        req.user?.sub ?? '',
      ].join(' ');
    },
    {
      stream: {
        write: (message: string) => logger.log(message.trim()),
      },
    },
  );
};
