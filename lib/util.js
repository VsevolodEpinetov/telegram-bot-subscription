const settings = require('../settings.json')
const date = require('../lib/date.js')
const { Wallet } = require("qiwi-sdk");

const BLOCKED_FIELDS = ["account", "comment", "sum"];

module.exports = {

  sleep: function (ms) {
    return new Promise(resolve => {
      setTimeout(resolve, ms)
    })
  },

  log: function (ctx) {
    let message = `\x1b[34m[INFO]\x1b[0m \x1b[36m${date.getCurrent().string.hhmmss}\x1b[0m `
    if (!ctx.update.callback_query) {
      if (ctx.message.text) {
        if (ctx.message.text[0] === '/') {
          message += `user ${ctx.message.from.id} has issued command \x1b[32m'/${ctx.message.text.split('/')[1]}'\x1b[0m `
          if (ctx.message.chat.type == 'private') {
            message += `in private chat`
          } else {
            message += `in chat named '${ctx.message.chat.title}' \x1b[37m(id ${ctx.message.chat.id})\x1b[0m`
          }
        }
      }
    } else {
      message += `user ${ctx.update.callback_query.from.id} has called an action \x1b[32m'${ctx.callbackQuery.data}'\x1b[0m `
      if (ctx.update.callback_query.message.chat.type == 'private') {
        message += `in private chat`
      } else {
        message += `in chat named '${ctx.update.callback_query.message.chat.title}' \x1b[37m(id ${ctx.update.callback_query.message.chat.id})\x1b[0m`
      }
    }
    console.log(message);
  },


  createPaymentURL: function (wallet, id, type, videoID) {
    let urlData = { blocked: BLOCKED_FIELDS};
    switch (type) {
      case 'subscription':
        urlData = {
          amount: settings.subscription.price,
          comment: `${id}`,
          ...urlData
        }
        break;
      case 'video':
        urlData = {
          amount: settings.videos[videoID].price,
          comment: `${id}-video${videoID}`,
          ...urlData
        }
        break;
    }
    const url = wallet.payments.createFormUrl(Wallet.Recipients.QIWI, urlData)
    return url;
  },


  newUserObject: function () {
    let user = {
      transactions: [],
      paidTill: 0,
      notified: [false, false, false],
      videosAvailable: []
    }

    return user;
  }

}