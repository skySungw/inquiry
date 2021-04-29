// pages/inquiry//inquiryActive/inquiryActive.js
import { ajax, ajax2, cdnStaticResourceUrl } from '../../../utils/util'
Page({

  /**
   * 页面的初始数据
   */
  data: {
    couponsData: [],
    organSign: null,
    activeGoodsList: [],
    cdn_link: cdnStaticResourceUrl
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.data.organSign = options.organSign;
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
    this.getCouponsData();
    this.getPackageAd();
  },
  //获取优惠券列表
  getCouponsData() {
    ajax2('post', 'miniapp/marketing/receiveAddCoupons', { 
      organSign: this.data.organSign 
    }, res => {
      if(res.data.code == 0) {
        if(!res.data.result) return false;
        if(res.data.result.actInfo && res.data.result.actInfo.isShowStoreActProduct) this.getHotGoods(res.data.result.actInfo.storeId); 
        this.setData({
          couponsData: res.data.result
        })
      }else {
        wx.showToast({
          title: res.data.msg,
          icon: 'none'
        })
      }
    })
  },
  //获取优惠券列表
  getPackageAd() {
    ajax2('post', 'miniapp/ad/getPackageAd', {}, res => {
      if(res.data.code == 0) {
        this.setData({
          packageAd: res.data.result
        })
      }else {
        wx.showToast({
          title: res.data.msg,
          icon: 'none'
        })
      }
    })
  },
   //获取活动商品
   getHotGoods(storeId) {
    let data = {};
    data = {
      drugstoreId: storeId,
      channel: 'MINI',
      classifyId: '51'//活动商品固定分类ID
    }
    ajax('get', 'mimiapp/drugStoreClassify/getDrugstoreGoodsByClassifyId', data, res => {
      wx.hideLoading();
      if (res.data.code == 0) {
        this.setData({
          activeGoodsList: res.data.result && res.data.result.list
        })    
      }else{
        wx.showToast({
          icon: 'none',
          title: res.data.msg
        })
      }
    })
  },
  //banner跳转
  toLink(e) {
    let target = e.currentTarget.dataset.item;
    if (!target.bannerUrl) return false;
    //2是自定义页面 3小程序页面
    if (target.bannerUrlType == 2) {
      wx.navigateTo({
        url: `/pages/webView/webView?link=${ encodeURIComponent(target.bannerUrl) }`
      })
    } else if (target.bannerUrlType == 3) {
      wx.navigateTo({
        url: target.bannerUrl
      })
    }
  },
  //特惠商品跳转商品详情
  toOrderDetail(e){
    let goodsId = e.currentTarget.dataset.item.medicinesId;
    let classifyId = e.currentTarget.dataset.item.classifyId;
    let drugStoreId = e.currentTarget.dataset.item.drugstoreId;
    wx.navigateTo({
      url: `/pages/onlineGoods/onlineGoodsDetail/onlineGoodsDetail?goodsId=${goodsId}&drugStoreId=${drugStoreId}&classifyId=${classifyId}`
    })
  },
  //优惠券点击跳转
  jumpLink(e) {
    // 0商品券 1问诊券
    if(e.detail.category == 0) {
      if(e.detail.establishYkqService == 1) {
        wx.navigateTo({
          url: `/pages/onlineGoods/drugList/drugList?drugStoreId=${ e.detail.storeId }`
        })
      }else {
        wx.switchTab({
          url: '/pages/noteIndex/noteIndex',
        })
      }
    }else if(e.detail.category == 1){
      wx.navigateTo({
        url: `/pages/inquiry/guidance/guidance`
      })
    }
  }
})