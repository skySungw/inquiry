// 获取全局类
let WebIM = wx.WebIM = require("../../../../../im/utils/WebIM")["default"];
// 消息存储
const msgStorage = require("../../../../../im/utils/msgStorage");
// 消息订阅者
const disp = require("../../../../../im/utils/broadcast.js");

Component({
  pageLifetimes: {
    show: function() {
      // 页面被展示
      console.log('inputbar show')
    },
    hide: function() {
      // 页面被隐藏
      console.log('inputbar hide')
    },
    resize: function(size) {
      // 页面尺寸变化
      console.log('inputbar resize')
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
      record: null,
      camera: null,
      image: null,
    },
    iconRecord: '../../images/record.png',
    iconRecordActive: '',
    iconCamera: '../../images/camera.png',
    iconImage: '../../images/pic.png',
    iconNoPrescripe:  '../../../../images/noteImg/empty.png',
    iconInquiryEnd: '../../../../images/icon-inquiry-end.png',
    recordStatus:'../../../../images/noteImg/empty.png',
    isIpx: '',
    userId: '',
    inputMessage: '',
    userMessage: '',
    prescripeData:'',
    hasPrescripeData: false,
    isShowHalfScreenDialog: true,
    isShowPrescripe: false
  },
  created() {
    console.log('inputbar created')
  },
  attached() {
    console.log('inputbar attached')
  },
  moved() {
    console.log('inputbar moved')
  },
  detached() {
    console.log('inputbar detached')
  },
  error() {
    console.log('inputbar error')
  },
  /**
   * 声明周期函数
   * 初始化组件
   * @param {isIpx} 
   */
  ready() {
    console.log('inputbar ready')
    this.data.__comps__.msglist = this.selectComponent("#msg-list");
    this.data.__comps__.record = this.selectComponent("#chat-record");
    this.data.__comps__.camera = this.selectComponent("#chat-camera");
    this.data.__comps__.image = this.selectComponent("#chat-image");
    this.getUserInfo();
    // this.setData({ isIpx: app.globalData.isIPX })
  },
  methods: {
    /**
     * 发送文本消息
     * @params { message } 消息对象
     */
    setMessageText(msg) {
      let _this = this;
      // 设置消息体
      // console.log('msg textmsg send inquiryId: ', _this.properties.inquiryInfo.inquiryId)
      try {
        msg.set({
          msg: _this.data.userMessage,
          // to: _this.data.inquiryInfo.physicianEasemobId,
          to: _this.properties.inquiryInfo.physicianEasemobId || wx.getStorageSync('physicianEasemobId'),
          from: wx.getStorageSync("userEasemoInfo").easeMoUserId,
          chatType: 'singleChat',
          roomType: false,
          ext: {
            inquiryId: _this.properties.inquiryInfo.inquiryId,
            sourceType: 1
          },
          success(id, serverMsgId) {
            console.log('success sss')
            getApp().globalData.loggerSDK.info(`xcxLogMsg sendTextMsgSuccess:${id} ${serverMsgId}`)
          },
          fail(error) {
            console.log("error:", error)
            console.log('发送失败')
            getApp().globalData.loggerSDK.info(`xcxLogMsg sendTextMsgFail:${error}`)
          }
        })
        // 发送消息
        WebIM.conn.send(msg.body);
        getApp().globalData.loggerSDK.info(`xcxLogMsg sendTextMsgEnd`)
      } catch (error) {
        getApp().globalData.loggerSDK.info(`xcxLogMsg sendTextMsgCatch:${error}`)
      }
      // 监听 triggerEvent 事件
      _this.triggerEvent( "newTextMsg",{ msg: msg, type: 'txt',}, { bubbles: true, composed: true });
      // 成功之后清空数据
      _this.setData({ userMessage: "", inputMessage: "" });
    },
    /**
     * 获取本地存储的用户信息
     * key { Object } res
     */
    getUserInfo () {
      this.data.userId = wx.getStorageSync("userInfo").userId;
    },
    /**
     *  输入框获取焦点事件
     */
    handleFocus (e) {
      this.triggerEvent("inputFocused", null, { bubbles: true });
    },
    /**
     * 输入框离开焦点事件
     */
    handleBlur () {
      this.triggerEvent("inputBlured", null, { bubbles: true });
    },
    /**
     * 获取输入框文本消息 value 事件
     */
    handleMessage (e) {
      this.setData({
        userMessage: e.detail.value
      });
    },
    /**
     * 输入框发送文本消息事件
     */
    handleSendMessage () {
      let _this = this;
      // 网络正常的情况下才能正常发送
      wx.getNetworkType({
        success(res) {
          const networkType = res.networkType
          if (networkType == 'none') {
            wx.showToast({
              title: "网络已断开,请稍后再试",
              icon: 'none',
              duration: 2000
            });
          } else {
            // String.prototype.trim = function () {
            //   return this.replace(/(^\s*)|(\s*$)/g, '');
            // };
            if (!_this.data.userMessage.trim()) {
              return;
            }
            let id = WebIM.conn.getUniqueId();
            let msg = new WebIM.message('txt', id);
            _this.setMessageText(msg);
          }
        }
      })
    },
    /**
     * 调用发送音频组件
     */
    handleSendAudio () {
      this.data.__comps__.record.toggleRecordModal();
    },
    /**
     * 调用相机组件
     */
    handleOpenCamera () {
      this.data.__comps__.camera.openCamera()
    },
    /**
     * 调用发送图片组件
     */
    handleSendImage () {
      this.data.__comps__.image.sendImage();
    },
    /**
     * 发送消息保存
     * @param { evt } Object 事件参数
     */
    saveSendMsg(evt) {
      msgStorage.saveMsg(evt.detail.msg, evt.detail.type);
    },
    /**
     * 跳转处方详情
     * @param { e } Object 事件参数
     */
    handleGoPrescripeDetail (e) {
      let info = this.data.inquiryInfo;
      let prescriptionId = e.currentTarget.dataset.id;
      wx.navigateTo({
        url: `/pages/note/prescriptionInfo/prescriptionInfo?prescriptionId=${prescriptionId}&patientId=${info.recipientId}&doctorId=${info.doctorId}`
      })
    } 
  }
})
