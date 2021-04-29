/**
 * @desc: 聊天页面（极速问诊、线下扫码补方）
 * @author: wangqinfei
 */
import { ajax } from "../../../../utils/util.js";
const disp = require("../../../../im/utils/broadcast");
// 请求url
const apiUrl = {
  // 获取会话页信息（患者信息和处方状态）
  getChatStatus: 'api/chat/inquiry/getstatus',
}

Page({
  data: {
    inquiryId: '',
    inquiryInfo: '',
    inquiryStatus: true, // 问诊状态
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    console.log('chatroom onLoad')
  },
  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log('chatroom onShow')
    this.handleChatStatus()
    let globalMsgMap = wx.getStorageSync('sessionMap')
    let curInquiryId = wx.getStorageSync('inquiryId')
    let isPageFromGuidance = wx.getStorageSync('guidance')
    if (globalMsgMap[curInquiryId]) {
      globalMsgMap[curInquiryId] = ""
    }
    wx.setStorageSync('sessionMap', globalMsgMap)
    // 从列表页进入会话，需要判断消息tab上的红点提示是否展示
    if (!isPageFromGuidance) {
      disp.fire('em.chat.unReadTabBarFlag')
    }
  },
  onReady: function () {
    console.log('chatroom onReady')
  },
  /**
   * 获取会话页信息
   */
  handleChatStatus() {
    let _this = this
    let curInquiryId = wx.getStorageSync('inquiryId')
    ajax('post', apiUrl.getChatStatus, { inquiryId: curInquiryId }, (res) => {
      if (res.data.code === 0 && res.data.result) {
        // 字符串转对象
        let _formatLastDiagnosis = JSON.parse(res.data.result.lastDiagnosis)
        res.data.result.lastDiagnosis = _formatLastDiagnosis;
        _this.setData({ inquiryInfo: res.data.result })
        wx.setStorageSync('physicianEasemobId', res.data.result.physicianEasemobId)
      } else {
        wx.showToast({
          title: res.data.msg || "服务器异常请重试...",
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    console.log('chatroom onHide')
    disp.fire('em.chat.clearCacheMsgArr')
  },
  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    console.log('chatroom onUnload')
    wx.setStorageSync('inquiryId', '')
  }
})