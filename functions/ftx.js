const axios = require('axios').default;
const { createHmac } = require('crypto');
const logger = require("firebase-functions/lib/logger");

class Ftx {
    constructor({ key, secret }) {
        this.key = key;
        this.secret = secret;
    }

    async request({ method, path, data, subAccount }) {
        path = `/api/${path}`;
        const ts = + new Date();
        const signature = createHmac('sha256', this.secret)
            .update(`${ts}${method}${path}${data ? JSON.stringify(data) : ""}`)
            .digest('hex');

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=UTF-8',
            'FTX-KEY': this.key,
            'FTX-SIGN': signature,
            'FTX-TS': ts,
        };

        if (subAccount) {
            headers['FTX-SUBACCOUNT'] = encodeURIComponent(subAccount);
        }

        return await axios({
            baseURL: 'https://ftx.com',
            method,
            url: path,
            headers,
            data,
        });
    }

    async getMarket({ marketName, subAccount }) {
        const response = await this.request({
            method: 'GET',
            path: `markets/${marketName}`,
            subAccount,
        });
        return response.data.result;
    }

    async getBalance({ coin, subAccount }) {
        const response = await this.request({
            method: 'GET',
            path: 'wallet/balances',
            subAccount,
        });
        return response.data.result.find(e => e.coin === coin);
    }

    async placeOrder({ data, subAccount }) {
        const response = await this.request({
            method: 'POST',
            path: 'orders',
            data,
            subAccount,
        });
        return response.data.result;
    }

    async getOpenOrders({ marketName, subAccount }) {
        const response = await this.request({
            method: 'GET',
            path: `orders?market=${marketName}`,
            subAccount,
        });
        return response.data.result;
    }

    async cancelOrder({ orderId, subAccount }) {
        const response = await this.request({
            method: 'DELETE',
            path: `orders/${orderId}`,
            subAccount,
        });
        return response.data;
    }

    async removeExpiredOrder({ marketName, subAccount }) {
        const openOrders = await this.getOpenOrders({ marketName, subAccount });
        const date = new Date();
        const expireOrderTime = 5 * 60 * 1000;
        for (const key in openOrders) {
            if (Object.hasOwnProperty.call(openOrders, key)) {
                const element = openOrders[key];
                if ((date - new Date(element.createdAt)) > expireOrderTime) {
                    await this.cancelOrder({ orderId: element.id, subAccount });
                }
            }
        }
    }

    async cancelAllOrders({ data, subAccount }) {
        const response = await this.request({
            method: 'DELETE',
            path: `orders`,
            data,
            subAccount,
        });
        return response.data;
    }

    async rebalance({ marketName, cost, rebalanceRate, minRate, startPrice, subAccount }) {
        // await this.removeExpiredOrder({ marketName, subAccount });
        await this.cancelAllOrders({
            data: {
                market: marketName,
            },
            subAccount
        });
        const market = await this.getMarket({ marketName, subAccount });
        const balance = await this.getBalance({ coin: market.baseCurrency, subAccount });
        const price = market.price;
        const minSize = market.minProvideSize
        const totalCoin = balance.total;
        const value = balance.usdValue;
        const rebalance = cost * rebalanceRate;
        const diff = Math.abs(rebalance - value) * 1;
        let orderAmount = diff / price;
        const isBuy = rebalance > value;
        if (startPrice <= 0) {
            startPrice = price;
        }
        const maxCoin = cost / startPrice;

        if (totalCoin >= maxCoin) {
            return null
        }

        if (totalCoin + orderAmount >= maxCoin) {
            orderAmount = maxCoin - totalCoin;
        }

        if (orderAmount < minSize) {
            return null
        }

        if (minRate && diff < rebalance * minRate) {
            return null
        }

        const dataOrder = {
            "market": marketName,
            "side": isBuy ? "buy" : "sell",
            "price": price,
            "type": "limit",
            "size": orderAmount,
            "reduceOnly": false,
            "ioc": false,
            "postOnly": false,
            "clientId": null
        };

        const orderResult = await this.placeOrder({ data: dataOrder, subAccount });
        return orderResult;
    }
}

module.exports = Ftx;