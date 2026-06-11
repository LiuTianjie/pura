declare module "jmuxer" {
  export default class JMuxer {
    constructor(options: {
      node: string | HTMLVideoElement;
      mode?: string;
      fps?: number;
      flushingTime?: number;
      maxDelay?: number;
      clearBuffer?: boolean;
      debug?: boolean;
      onError?: (error: unknown) => void;
    });

    feed(data: { video?: Uint8Array; audio?: Uint8Array; duration?: number }): void;
    destroy(): void;
  }
}
