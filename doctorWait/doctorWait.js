import {ajax, ajax2, cdnStaticResourceUrl } from '../../../utils/util'
import { initJump, handleToWaiting, handleToUnload } from "../../../common/toChatroom"
let pageName = 'doctorWait'
Page({
  /**
   * 页面的初始数据
   */
  data: {
    inquiryInfo: { // 用药申请卡面信息
      type: Object,
      value: {},
    },
    userInfo: {},
    lastDiagnosis: { // 预购药品信息
      type: Object,
      value: {},
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log(`${pageName} onLoad`)
    // TODO: 2处修改
    wx.setStorageSync('inquiryId', options.inquiryId)
    this.getUserInfo(options.inquiryId, options.organSign);
  },
  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log(`${pageName} onShow`)
    wx.setStorageSync('guidance', true)
    initJump(this.handleToChatroom)
  },
  onReady: function () {
    console.log(`${pageName} onReady`)
  },
  // 用药申请卡面信息
  getUserInfo (inquiryId, organSign) {
    let that = this;
    wx.showLoading({
      title: '加载中...'
    })

    ajax2('POST', 'patient/im/inquiry/patientImInfo', {
      inquiryId
    }, (res) => {
      wx.hideLoading();
      console.log('卡面信息',res.data)
      if(res.data.code == 0) {
        that.setData({
          inquiryInfo: res.data.result,
          lastDiagnosis: JSON.parse(res.data.result.lastDiagnosis)
        })
        handleToWaiting({patientGuid: res.data.result.patientGuid, organSign: organSign})
        wx.pageScrollTo({
          scrollTop: 99999,
        })
      } else {
        wx.showToast({
          icon: 'none',
          title: res.data.msg
        })
      }
    })

  },
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
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    console.log(`${pageName} onUnload`)
    handleToUnload()
  },
  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    console.log(`${pageName} onHide`)
  },
})