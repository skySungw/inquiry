/**
 * @desc: 聊天组件
 * @author: wangqinfei
 */
const msgStorage = require("../../../../im/utils/msgStorage");
Component({
  pageLifetimes: {
    show: function() {
      // 页面被展示
      console.log('chat show')
    },
    hide: function() {
      // 页面被隐藏
      console.log('chat hide')
    },
    resize: function(size) {
      // 页面尺寸变化
      console.log('chat resize')
    }
  },
  /**
   * 组件的属性列表
   */
  properties: {
    inquiryInfo: {
      type: Object,
      value: {}
    },
    chatType: {
      type: String,
      value: 'singleChat',
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    __comps__: {
      msglist: null,
      inputbar: null
    },
    isInputBar: true
  },
  created() {
    console.log('chat created')
  },
  attached() {
    console.log('chat attached')
  },
  moved() {
    console.log('chat moved')
  },
  detached() {
    console.log('chat detached')
  },
  error() {
    console.log('chat error')
  },
  /**
   * 声明周期函数
   */
  ready() {
    // 消息列表调用
    this.data.__comps__.msglist = this.selectComponent("#msg-list");
    // 输入框组件调用 
    this.data.__comps__.inputbar = this.selectComponent("#chat-inputbar");
  },
  /**
   * 组件的方法列表
   */
  methods: {
    saveSendMsg(evt) {
      msgStorage.saveMsg(evt.detail.msg, evt.detail.type);
    },
    getMore () {
      this.selectComponent('#chat-msglist').getHistoryMsg()
    },
    // 问诊15分钟后，重新加载问诊信息
    noticeRecallInquiryInfoTransition () {
      console.log("问诊15分钟结束，index");
      this.triggerEvent('noticeRecallInquiryInfo')
    },
    hideInputBar() {
      this.setData({
        isInputBar: false
      })
    }


  }
})
