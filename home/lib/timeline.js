class LogarithmicQueue {
    constructor(scale = 10) {
        this.list = [];
        this.count = 0;
        this.back = null;
        this.scale = scale;
    }

    _addBack(item) {
        if (this.back == null)
            this.back = new LogarithmicQueue(this.scale);
        this.back.push(item);
    }

    _percolate() {
        const { list, scale, count } = this;
        if (list.length > scale) {
            const oldest = list.shift();
            if (count === 0)
                this._addBack(oldest);
            this.count = (count + 1) % scale;
        }
    }

    push(item) {
        this.list.push(item);
        this._percolate();
    }

    *[Symbol.iterator]() {
        const { back, list } = this;
        if (back != null)
            for (const item of back)
                yield item;
        for (const item of list)
            yield item;
    }
}

export class Timeline {
    constructor() {
        this.samples = new LogarithmicQueue();
    }

    addPoint(timestamp, value) {
        const { samples } = this;
        samples.push({ timestamp, value });
    }

    findValue(timestamp) {
        const terpolate = (s1, s2, timestamp) => {
            const portion = (timestamp - s1.timestamp) / (s2.timestamp - s1.timestamp);
            return s1.value + portion * (s2.value - s1.value);
        };

        const samples = [...this.samples];
        let s2 = samples[samples.length - 1];
        for (let i = samples.length - 2; i >= 0; i--) {
            const s1 = samples[i];
            if (s1.timestamp < timestamp) {
                return terpolate(s1, s2, timestamp);
            }
            s2 = s1;
        }
        if (samples.length >= 2) {
            return terpolate(samples[0], samples[samples.length - 1], timestamp);
        }
        return 0;
    }
}
