const Binance = require('node-binance-api');

class BinanceRebalance {
    constructor(key, secret) {
        this.binance = new Binance().options({
            APIKEY: key,
            APISECRET: secret
        });
    }

    async spotRebalance({ symbol, buySymbol, sellSymbol, cost, rate, min }) {
        const ticker = await this.binance.prices();
        const balance = await this.binance.balance();
        const price = ticker[symbol] * 1;
        const amount = balance[buySymbol].available * 1;
        const value = price * amount;
        const rebalance = cost * rate;
        const diff = Math.abs(rebalance - value) * 1;
        const orderAmount = diff / price;
        const isBuy = rebalance > value;

        await this.binance.cancelAll(symbol);

        if (diff < min) return null;

        console.info({
            symbol,
            buySymbol,
            sellSymbol,
            price,
            amount,
            value,
            buy: isBuy ? orderAmount : 0,
            sell: isBuy ? 0 : orderAmount,
            net: amount + (isBuy ? orderAmount : -orderAmount),
            profit: rebalance - value,
        });

        if (isBuy) {
            await this.binance.buy(symbol, orderAmount, price);
        } else {
            await this.binance.sell(symbol, orderAmount, price);
        }
    }
}

module.exports = BinanceRebalance;