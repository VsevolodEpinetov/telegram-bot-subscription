const RedisSession = require('telegraf-session-redis')

const globalSession = new RedisSession({
  property: 'globalSession',
  getSessionKey: () => { return "global" }
})

const userSession = new RedisSession({
  property: 'userSession',
  getSessionKey: (ctx) => { if (ctx.from) return ctx.from.id }
})

const chatSession = new RedisSession({
  property: 'chatSession',
  getSessionKey: (ctx) => { if (ctx.chat) return ctx.chat.id }
})

const session = new RedisSession({
  getSessionKey: (ctx) => {
    if (!ctx.chat && !ctx.from) {
      return
    }
    return `${ctx.from.id}:${ctx.chat.id}`
  }
})

module.exports = {
  GLOBAL_SESSION: globalSession,
  USER_SESSION: userSession,
  CHAT_SESSION: chatSession,
  UNIQUE_SESSION: session
};