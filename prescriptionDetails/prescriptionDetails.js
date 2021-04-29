// pages/onlineGoods/prescriptionDetails/prescriptionDetails.js
import {ajax, ajax2, cdnStaticResourceUrl } from '../../../utils/util'

const APIUrl = {
  videoUrl: "api/patientinfo/getPrescriptionDetailByInquiryId",
  tuwenUrl: "miniapp/InquiryIM/queryPrescriptionInfoByGuid"
}

Page({
  /**
   * 页面的初始数据
   */
  data: {
    banner:null,
    inquiryId:'',
    guid: '',
    jsonData: {},
    ext: {},
    cf_chapter: cdnStaticResourceUrl,
    statusImageList: [], // 审方图片标识列表
    detailTitle: '', // 提示
    title: '',
    reasonTitle: '', // 头部文案
    statusList: [], // 审方文字标识列表
    status_u: '', // 1 待开方 2 已关闭 3 已超时  4 开方成功、等待上传 5 上传成功 6 待签名 7 医师签名成功 8 医师签名失败 9 药师签名成功 10 药师签名失败
    auditStatus: '', // 审批状态  1 待审核 2 审批通过 3 审核不通过
    // 代开方
    auditStatus_u: '', // 待审核状态
    auditStatus_us: '', // 已审核状态
    isCenter: false, // 文字居中
    inquiryType: null, // 区分视频字段
    inquiryUrl: '', // 接口地址
    params:{}, // 传入接口参数
    methedType: '', // 接口请求方法
    savaPrescriptionImg: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    const config = {
      video: () =>{
        return {
          inquiryUrl: APIUrl.videoUrl,
          params: {inquiryReportGuid: options.inquiryId},
          methedType: 'post'
        }
      },
      tuwen: () =>{
        return {
          inquiryUrl: APIUrl.tuwenUrl,
          params: options.inquiryId ? {inquiryId: options.inquiryId} : {guid: options.guid},
          methedType: 'get'
        }
      },
    }
    options.inquiryType === 'video' ?  this.getQueryPrescriptionInfo(config['video']()) :  this.getQueryPrescriptionInfo(config['tuwen']())
    let userId = wx.getStorageSync('userInfo') ? wx.getStorageSync('userInfo').userId : ''
    getApp().globalData.burySpotSDK.track('page_PrescriptionExpo',  {
      userId: userId,
      inquiryId: options.inquiryId
    });
  },
  onShow(){
    this.getBanner();
  },
  /**
   * @description: 获取页面 options 参数
   * @params  {Object} options
   * return {void}
   */
  getQueryPrescriptionInfo(options) {
    wx.showLoading({
      title: '加载中'
    })
    ajax2(options.methedType, options.inquiryUrl, options.params ,res=> {
      wx.hideLoading();
      if (res.data.code === 0) {
        let data = res.data.result;
        if (data){
          data.inquiryPrescription.outPrescriptionTime = this.timeStampTurnTime(data.inquiryPrescription.outPrescriptionTime);
          this.setData({
            jsonData: data,
            ext: JSON.parse(data.inquiryPrescription.ext),
            status_u: data.inquiryPrescription.status,
            auditStatus: data.inquiryPrescription.auditStatus,
            title: JSON.parse(data.inquiryPrescription.unPrescribeReason)[1],
            reasonTitle: JSON.parse(data.inquiryPrescription.unPrescribeReason)[0],
            savaPrescriptionImg: data.inquiryPrescription.prescriptionImage
          },function (){
            this.init();
          })
        }
      } else {
        wx.showToast({
          title: res.data.msg,
          duration: 3000,
          icon: 'none'
        })
      }
    }, e => {
      wx.showToast({
        title: '请求失败',
        duration: 3000,
        icon: 'none'
      })
    })
  },
  getBanner(){
    let _url = {
      adType: 10
    }

    ajax2('GET', 'miniapp/notify/getPurchaseBanner', _url, res=> {
      this.setData({
        banner:res.data.result
      })
    }, e => {
      wx.showToast({
        title: '请求失败',
        duration: 3000,
        icon: 'none'
      })
    });

  },
  /**
   * @description: 获取 url 参数
   * @params  {String} url
   * return {String} 格式化后的 url
   */
  getCompleteUrl(url) {
    let resultUrl = '';
    // 分割url
    let urlArray = url.split('?');
    // 获取全局sess_key
    let token = wx.getStorageSync('loginInfo').token;
    // 区分 url 后是否带参数
    if (urlArray[1]) {
      resultUrl = `${urlArray[0]}?${urlArray[1]}&token=${token}`;
    } else {
      resultUrl = `${urlArray[0]}?token=${token}`;
    }
    return resultUrl;
  },
  tolink(){
    let data = this.data.banner[0];
    // bannerUrlType 2自定义页面，3小程序页面；
    let url = this.getCompleteUrl(data.bannerUrl);
    if (data.bannerUrlType == 2){
      if (data.activityPageShare) {
        const activityPageShare = JSON.stringify(data.activityPageShare)
        if (data.bannerUrl.indexOf('?') > -1) {
          url = `${data.bannerUrl}&activityPageShare=${encodeURIComponent(activityPageShare)}`
        } else {
          url = `${data.bannerUrl}?activityPageShare=${encodeURIComponent(activityPageShare)}`
        }
      }
      // let url = target.bannerUrl + '&token=' + getApp().globalData.sess_key;
      // 参数格式化        
      wx.navigateTo({
        url: `/pages/webView/webView?link=${encodeURIComponent(url)}`
      })
    }else{
      wx.navigateTo({
        url: data.bannerUrl
      })
    }
    getApp().globalData.burySpotSDK.track('action_offlineInquiryResult_bannerClick');
  },
  //时间戳转时间类型
  timeStampTurnTime(timeStamp) {
    if (timeStamp > 0) {
      var date = new Date();
      date.setTime(timeStamp);
      var y = date.getFullYear();
      var m = date.getMonth() + 1;
      m = m < 10 ? ('0' + m) : m;
      var d = date.getDate();
      d = d < 10 ? ('0' + d) : d;
      var h = date.getHours();
      h = h < 10 ? ('0' + h) : h;
      var minute = date.getMinutes();
      var second = date.getSeconds();
      minute = minute < 10 ? ('0' + minute) : minute;
      second = second < 10 ? ('0' + second) : second;
      return y + '-' + m + '-' + d;
    } else {
      return "";
    }
  },
  toComfirmProducts() {
    wx.navigateTo({
      url: `/pages/quickConsultation/pages/selectProducts/selectProducts?prescriptionNum=${ this.data.jsonData.inquiryPrescription.guid }`,
    })
  },
  // 视频问诊新增
  init () {
    if (this.data.auditStatus > 1) {
      this.setData({
        status_u: 5
      })
    }
    if (this.data.auditStatus === 1) {
      if (this.data.status_u > 3) {
        this.setData({
          status_u: 5,
          auditStatus_u: 1,
        })
      }
    }
    if (this.data.auditStatus === 2) {
      this.setData({
        auditStatus_u: 2,
        auditStatus_us: 2,
      })
    }
    if (this.data.auditStatus === 3) {
      this.setData({
        auditStatus_u: 2,
        auditStatus_us: 3,
      })
    }
    if (this.data.status_u === 1) {
      this.setData({
        detailTitle: '医生正在为您开方，请稍等',
      })
    } else if (this.data.status_u === 2) {
      this.setData({
        detailTitle: this.data.title,
        isCenter: true,
      })
    } else if (this.data.status_u === 3) {
      this.setData({
        detailTitle: this.data.title,
        isCenter: true,
      })
    } else if (this.data.status_u === 0) {
      this.setData({
        detailTitle: '您已取消问诊'
      })
    } else if (this.data.auditStatus_u === 1) {
      this.setData({
        detailTitle: '药师审核处方后，我们将为您推送审核结果'
      })
    } else if (this.data.auditStatus_us === 3) {
      this.setData({
        detailTitle: '您的处方审核未通过'
      })
    } else if (this.data.auditStatus_u === 2) {
      if (this.data.jsonData.inquiryPrescription.isEffective === 0) {
        this.setData({
          detailTitle: '您的处方已通过审核'
        })
      } else if (this.data.jsonData.inquiryPrescription.isEffective === 1) {
        this.setData({
          detailTitle: '处方已使用'
        })
      } else if (this.data.jsonData.inquiryPrescription.isEffective === 2) {
        this.setData({
          detailTitle: '处方已过期'
        })
      }
    }

    // this.status = res.status
    // this.auditStatus = res.auditStatus
    // 设置审核图片图标icon样式
    this.setStatusImgList(this.data.status_u, this.data.auditStatus_u, this.data.auditStatus_us);
    // 设置审核文字
    this.setStatusList(this.data.status_u, this.data.auditStatus_us);
  },
  /**
   * @description: 设置审核状态列表
   * @param {}
   * @return:
   */
  setStatusList(status, auditStatus) {
    this.data.statusList.push('已问诊');
    const step = this.filterStatus(status)
    if (step) {
      this.data.statusList.push(step)
    }
    this.data.statusList.push("待审核");
    this.data.statusList.push(this.filterAuditStatus(auditStatus));

    this.setData({
      statusList: this.data.statusList
    })
  },
  /**
   * @description: 获取开方状态
   * @param {}
   * @return:
   */
  filterStatus(status) {
    const STATUS = {
      3: '处方关闭',
      2: '处方关闭',
      1: '待开方'
    }
    return STATUS[status] ? STATUS[status] : '待开方';
  },
  /**
   * @description: 获取审核状态
   * @param {}
   * @return:
   */
  filterAuditStatus(status) {
    const STATUS = {
      2: '已审核',
      3: '审核驳回'
    }
    return STATUS[status] ? STATUS[status] : '已审核';
  },
  /**
   * @description: 设置审核图片
   * @param {}
   * @return:
   */
  setStatusImgList(status, adu, adus) {
    this.data.statusImageList.push('../../../images/success.png');
    this.data.statusImageList.push(this.filterStatusImg(status));
    this.data.statusImageList.push(this.filterStatusAuditImg(adu));
    this.data.statusImageList.push(this.filterStatusAuditsImg(adus));
    this.setData({
      statusImageList: this.data.statusImageList
    })
  },
  /**
   * @description: 待开方，第二栏样式
   * @param {}
   * @return:
   */
  filterStatusImg(status) {
    const STATUS = {
      1: '../../../images/waitpre.png',
      2: '../../../images/fail-2.png',
      3: '../../../images/fail-2.png',
      5: '../../../images/success.png'
    }
    return STATUS[status];
  },
  /**
   * @description: 待审核，第三栏样式
   * @param {}
   * @return:
   */
  filterStatusAuditImg(status) {
    const STATUS = {
      1: '../../../images/waitpre.png',
      2: '../../../images/success.png'
    }
    return STATUS[status] ? STATUS[status] : '../../../images/wait.png';
  },
  /**
   * @description: 已审核，第四栏样式
   * @param {}
   * @return:
   */
  filterStatusAuditsImg(status) {
    const STATUS = {
      3: '../../../images/fail-2.png',
      2: '../../../images/success.png'
    }
    return STATUS[status] ? STATUS[status] : '../../../images/wait.png';
  },
  savePrescription() {
    if(!this.data.savaPrescriptionImg) {
      wx.showToast({
        title: '找不到处方',
        icon: 'none'
      })
      return false;
    }
    wx.downloadFile({
      url: this.data.savaPrescriptionImg,//图片地址
      success: function (res) {
        //图片保存到本地
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: function (data) {
            wx.showToast({
              title: '保存成功，请到相册查看',
              icon: 'none'
            })
          },
          fail: function (err) {
            wx.showToast({
              title: err,
              icon: 'none'
            })
          }
        })
      }
    })
  }
})