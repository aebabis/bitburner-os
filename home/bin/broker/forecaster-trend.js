const HISTORY = 10;

export const forecaster = () => {
    const histories = {};
    const record = (data) => {
        const { sym } = data;
        if (histories[sym] == null)
            histories[sym] = [];
        histories[sym].push(data);
        while(histories[sym].length > HISTORY)
            histories[sym].shift();
    };

    return {
        record,
        getStockForecast: (sym) => {
            const history = histories[sym];
            if (history == null || history.length < HISTORY)
                return null;
            let prev = history[0];
            let good = 0;
            let bad = 0;
            for (let i = 1; i < HISTORY; i++) {
                const { price } = history[i];
                if (price > prev)
                    good++;
                else
                    bad++;
                prev = price;
            }
            return good / (good + bad);
        },
    };
};
