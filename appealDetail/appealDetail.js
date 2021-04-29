/**
 * desc: 问诊记录：申诉详情
 * auth: wangqinfei
 */
import { ajax } from "../../../utils/util";
// 请求url
const apiUrl = {
  // 获取会话页信息（患者信息和处方状态）
  getProAppealDetail: 'api/appeal/getProAppealDetail',
}
Page({

  /**
   * 页面的初始数据
   */
  data: {
    curAppealDetail: '',
    appealDetailing: '../../../images/appealDetailing.png',
    appealDetailNot: '../../../images/appealDetailNot.png',
    appealDetailPass: '../../../images/appealDetailPass.png'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    let orderNo = options.orderNo || ''
    if (orderNo) {
      this.handleGetProAppealDetail(orderNo)
    } else {
      wx.showToast({
        title: '获取申诉详情异常，请重试！',
        mask: true,
        duration: 2000
      })
    }
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
    
  },

  handleGetProAppealDetail(orderNo) {
    ajax('get', apiUrl.getProAppealDetail, {
      orderNo
    }, res => {
      if (res.data.code == 0) {
        this.setData({
          curAppealDetail: res.data.result
        })
        console.log('111', res.data.result)
      } else {
        wx.showToast({
          title: res.data.msg,
          icon: 'none',
          mask: true,
          duration: 2000
        })
      }
    })
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