# telegram-bot-subscription

Small telegram bot for a paid subscription based channel-like experience.
Payments are processed by qiwi.

### Packages used
1. ✈️ [telegraf](https://github.com/telegraf/telegraf) and [redis session middleware](https://github.com/telegraf/telegraf-session-redis)
2. 🥝 [qiwi SDK](https://github.com/AlexXanderGrib/node-qiwi-sdk)

### .env should look like
```
BOT_TOKEN="your-telegram-bot-token"
QIWI_TOKEN="your-qiwi-application-token"
QIWI_WALLET_NUMBER="your-qiwi-wallet-number"
```
