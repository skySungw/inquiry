/**
 * desc: 问诊等待页面
 * auth: wangqinfei
 */
import { initJump, handleToWaiting, handleToUnload } from "../../../common/toChatroom"
Page({

  /**
   * 页面的初始数据
   */
  data: {

  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    let inquiryId = options.inquiryId
    let patientGuid = options.patientGuid
    wx.setStorageSync('inquiryId', inquiryId)
    handleToWaiting({ patientGuid })
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    wx.setStorageSync('guidance', true)
    initJump(this.handleToChatroom)
  },
  // 跳转咨询页面
  handleToChatroom (chatroomFlag) {
    console.log('handleToChatroom chatroomFlag:', chatroomFlag)
    if (!chatroomFlag) {
      console.log('handleToChatroom:', wx)
      wx.redirectTo({
        url: `../chat/pages/chatroom`
      })
    }
  },
  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    handleToUnload()
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})