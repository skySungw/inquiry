import { ajax2, ajax, throttle } from "../../../../../utils/util.js";
import saveReceiveMsg from "../../../../../im/utils/formatMsgData" 
// 引入依赖文件
let msgStorage = require("../../../../../im/utils/msgStorage");
let disp = require("../../../../../im/utils/broadcast");

// 请求url
const apiUrl = {
  getChatHistory: 'chat/history',
  getRateStar: 'api/rating/getRatingStar',
  saveRateStar: 'api/rating/saveRatingStar',
  getChatStatus: 'api/chat/inquiry/getstatus',
  getPurchaseBanner: 'miniapp/notify/getPurchaseBanner',
  getPrescriptionSrc:'miniapp/InquiryIM/queryPrescriptionInfoByGuid' // 获取处方图片
}
let _this
Component({
  pageLifetimes: {
    // 组件所在页面的生命周期函数
    show: function () {
      console.log('msglist show', this.properties.inquiryInfo)
      if (this.properties.inquiryInfo && this.properties.inquiryInfo.inquiryId) {
        this.getLeftTime(this.properties.inquiryInfo.inquiryId)
      }
    },
    hide: function () { 
      console.log('msglist hide')
      this.setData({
        couponAlertShow: false
      })
      this.clearLeftTimer();
    },
    resize: function(size) {
      // 页面尺寸变化
      console.log('msglist resize')
    }
  },
  properties: {
    inquiryInfo: {
      type: Object,
      value: {},
      observer: function(newVal, oldVal) {
        if (newVal && newVal.inquiryId) {
          if (this.data.tempInquiryId !== newVal.inquiryId) {
            console.log('new inquiryInfo:', newVal)
            wx.setNavigationBarTitle({
              title: newVal.physicianName
            })
            this.setData({
              tempInquiryId: newVal.inquiryId,
              prescriptionNum: newVal.prescriptionGuid,
              inquiryType: newVal.inquiryType,
              thirdOrderNo: newVal.thirdOrderNo,
              inquirySource: newVal.inquirySource
            })
            if (!wx.getStorageSync('guidance')) {
              this.handleChatHistory()
            }
            // 扫码补方、极速问诊结束 inquiryType = 1扫码补方 2极速问诊
            if ((newVal.inquiryType === 1 && newVal.inquiryStatus === 1) || (newVal.inquiryType === 2 && newVal.speedStatus !== 0)) {
              this.triggerEvent('hideInputBar')
              // this.triggerEvent('noticeRecallInquiryInfo')
              if (newVal.inquiryType === 1 && newVal.inquiryStatus === 1) {
                this.handleGetPurchaseBanner()
              }
              this.setData({
                isEnd: true,
                hideInputBar: true
              })
            }
            if (newVal.status === 5) {
              this.setData({
                checkPass: true,
                prescribeMsgFlag: 3
              })
            } else if (newVal.status === 7) {
              this.setData({
                checkNoPass: true,
                prescribeMsgFlag: 4
              })
            }
            // 扫码补方 - 开方逻辑
            if (newVal.inquiryType === 1) {
              if (newVal.status === 3) {
                this.noExtractionFunc()
              } else if (newVal.status === 8) {
                this.extractionFunc()
              }
            }
            // 极速问诊审核逻辑判断
            if (newVal.inquiryType === 2 && (newVal.speedStatus == 1 || newVal.speedStatus == 4 || newVal.speedStatus == 5 || newVal.status === 5 || newVal.status === 7 || newVal.status === 8)) {
              this.setData({
                isMsgImRate: true
              })
              if (this.data.stepActive !== '4') {
                this.setData({
                  stepActive: '3'
                })
              }
            }
            console.log('newVal.leftTime', newVal.leftTime)
            if (newVal.inquiryType === 2) {
              this.getRate()
              if (newVal.leftTime >= 0) {
                this.interrogationCountDown(newVal.leftTime);
              }else {
                console.log("observer--当前问诊人已经用时15分钟")
              }
            }
            // 极速问诊退款
            if (newVal.inquiryType === 2 && newVal.speedStatus === 5) {
              this.setData({
                refundType: true,
                refundReason: newVal.refundReason
              })
            }
          }
        }else {
          console.log("observer--不存在inquiryInfo")
        }
      } 
    },
  },
  data: {
    page: 0,
    index: 0,
    toView: "",
    curMsgMid: '',
    chatMsg: [],
    visibility: false,
    iconErro: '../../images/msgerr.png',
    iconDoctorDefault: '../../images/doctor_head_default@2x.png',
    selfHeadDefault0: '../../images/self_head_default0@2x.png',
    selfHeadDefault1: '../../images/self_head_default1@2x.png',
    userInfo: '',
    overflow: 'auto',
    windowHeight: wx.getSystemInfoSync().windowHeight,
    stepActive: '2',            // 导航步骤
    rate: null,                 // 评价星星
    isMsgImRate: false,         // 是否显示评价组件
    pageNum: 1,                 // 页码
    isData: false,              // 是否有数据
    firstHistoryLoad: true,     // 是否第一加载
    tempInquiryId: '',
    checkPass: false,           // 审核通过
    checkNoPass: false,         // 审核驳回
    isEnd: false,               // 问诊结束
    hideInputBar: false,        // 输入框隐藏
    prescriptionNum: '',        // 去购药
    guid: '',                   // guid
    pages: null,                // 历史消息总页数
    msgArr: [],
    askLeftTimer: null,          // 问诊剩余时间定时器
    inquiryType: '', // 问诊类型:0视频问诊，1图文问诊 2极速问诊
    bannerImage: '',
    bannerUrl: '',
    prescribeMsg: '', // 医生开方信息
    prescribeMsgFlag: 0, // 医生开方状态
    prescribeStatus: 0, // 0-未开方 1-开方
    prescribePic: '', // 处方图片
    thirdOrderNo: '', // 订单编号
    inquirySource: 3, // 绿地来源
    refundType: false, // 退款状态
    refundReason: '', // 退款原因
    couponAlert: {},
    couponAlertShow: false,
    organSign: null
  },
  created() {
    console.log('msglist created')
  },
  moved() {
    console.log('msglist moved')
  },
  error() {
    console.log('msglist error')
  },
  /**
   * 声明周期
   */
  attached() {
    console.log('msglist attached')
    _this = this
    this.data.page = 0;
    this.data.index = 0;
    this.data.visibility = true;
    console.log('inquiryIdinquiryIdinquiryIdinquiryId', this.properties.inquiryInfo)
    this.initMsg()
    if (this.properties.inquiryInfo && this.properties.inquiryInfo.inquiryId) {
      this.getLeftTime(this.properties.inquiryInfo.inquiryId)
    }
  },

  /**
   * 生命周期
   */
  detached() {
    console.log('msglist detached')
    wx.setStorageSync('chatroomPage', false)
    this.data.visibility = false;
    this.clearLeftTimer();
    disp.off('em.chat.newCmdMsg', this.dispNewCmdMsg)
    msgStorage.off('newChatMsg', this.dispNewChatMsg)
  },

  /**
   * 生命周期
   */
  ready(event) {
    console.log('msglist ready')
  },
  methods: {
    // 开方
    extractionFunc() {
      // 开方状态
      this.triggerEvent('hideInputBar')
      this.triggerEvent('noticeRecallInquiryInfo')
      this.handleGetPurchaseBanner()
      let text = ''
      if (this.data.inquirySource == 3) {
        text = '医生已开完处方，请等待药师审核'
      } else if (this.data.inquirySource == 7) {
        text = '医生已开具处方'
      }
      this.setData({
        prescribeMsg: text,
        prescribeMsgFlag: 2,
        hideInputBar: true,
        stepActive: '3',
        prescribeStatus: 1
      })
    },
    // 无需开方
    noExtractionFunc() {
      this.triggerEvent('hideInputBar')
      this.triggerEvent('noticeRecallInquiryInfo')
      this.handleGetPurchaseBanner()
      this.setData({
        prescribeMsg: '医生已取消开方，如有需要您可以发起新的问诊',
        prescribeMsgFlag: 1,
        hideInputBar: true,
        stepActive: '3'
      })
    },
    // 获取最新leftTime
    getLeftTime(inquiryId) {
      let that = this
      ajax('post', apiUrl.getChatStatus, { inquiryId: inquiryId }, (res) => {
        if (res.data.code === 0 && res.data.result) {
          let leftTime = res.data.result.leftTime
          // that.data.organSign = res.data.result.organSign;
          console.log('leftTimeleftTimeleftTime', leftTime, that.data.organSign, res.data.result.organSign)
          if (leftTime > 0) {
            that.interrogationCountDown(leftTime)
          }
        } 
      })
    },
    initMsg() {
      disp.on('em.chat.newCmdMsg', this.dispNewCmdMsg)
      msgStorage.on("newChatMsg", this.dispNewChatMsg)
      wx.setStorageSync('chatroomPage', true)
      if (wx.getStorageSync('guidance')) {
        disp.fire('em.chat.isChatroomPage') 
      }
    },
    dispNewChatMsg(renderableMsg, type, isNew) {
      let inquiryId = wx.getStorageSync('inquiryId')
      if (Array.isArray(renderableMsg)) {
        let curChatMsg = renderableMsg.filter((msgItem) => {
          return inquiryId === msgItem.msg.ext.inquiryId
        })
        console.log('chatroom curChatMsg:', curChatMsg)
        _this.data.msgArr = [..._this.data.msgArr, ...curChatMsg]
        _this.setData({
          chatMsg: _this.data.msgArr,
        }, function() {
          let toView = _this.data.isMsgImRate ? 'rate' : _this.data.msgArr.length ? _this.data.msgArr[_this.data.msgArr.length - 1].mid : ''
          wx.nextTick(() => {
            _this.setData({
              toView
            }) 
          })
        })
      } else {
        // 判断是否属于当前会话
        console.log('www onMsg renderableMsg:', renderableMsg.msg.ext.inquiryId)
        console.log('renderableMsg.msg.ext', renderableMsg.msg.ext)
        if (inquiryId === renderableMsg.msg.ext.inquiryId) {
          _this.data.msgArr.push(renderableMsg)
          if (renderableMsg.msg.ext.rxId) {
            //接收到有处方
            if(_this.data.inquiryType == 1) _this.getCouponAlert();
            _this.setData({
              stepActive: '3',
              isMsgImRate: true,
              guid: renderableMsg.msg.ext.rxId
            })
          }
          console.log('_this.data.isMsgImRate:', _this.data.isMsgImRate)
          console.log('ararararararrarar', _this.data.msgArr)
          _this.setData({
            chatMsg: _this.data.msgArr,
          }, function() {
            let toView = _this.data.isMsgImRate? 'rate': _this.data.msgArr.length ? _this.data.msgArr[_this.data.msgArr.length - 1].mid : ''
            wx.nextTick(() => {
              _this.setData({
                toView: toView
              }) 
            })
          })
        }
      }
    },
    dispNewCmdMsg(extMsg) {
      console.log('type11111111', extMsg)
      let inquiryId = wx.getStorageSync('inquiryId')
      if (inquiryId === extMsg.inquiryId) {
        if (_this.data.inquiryType === 1 && extMsg.type === '1') {
          _this.noExtractionFunc()
          _this.setData({
            isEnd: true
          })
        } else if (_this.data.inquiryType === 1 && extMsg.type === '2') {
          _this.extractionFunc()
          _this.setData({
            isEnd: true
          })
        } else if ( extMsg.type === '3') {
          _this.setData({
            checkPass: true,
            prescriptionNum: extMsg.prescriptionId,
            prescribeMsgFlag: 3
          })
        } else if (extMsg.type === '4') {
          _this.setData({
            checkNoPass: true,
            prescribeMsgFlag: 4
          })
        } else if (extMsg.type === '6') {
          _this.triggerEvent('hideInputBar')
          _this.triggerEvent('noticeRecallInquiryInfo')
          let stepActive = _this.data.rate? '4':'3'
          _this.setData({
            isEnd: true,
            hideInputBar: true,
            isMsgImRate: true,
            stepActive: stepActive,
          }, function() {
            _this.setData({
              toView: 'rate'
            }) 
          })
        } else if (extMsg.type === '7') {
          _this.setData({
            refundType: true,
            refundReason: JSON.parse(extMsg.extJson).refundReason
          })
        }
      }
    },
    /**
     * 消息图片预览
     * @param { event } 事件回调 
     */
    previewImage(event) {
      let url = event.target.dataset.url;
      wx.previewImage({
        urls: [url]
      });
    },
    /**
     * 患者信息图片预览
     * @param { event } 事件回调
     */
    handlePreviewImg(event) {
      let patientPhotos = this.data.inquiryInfo.patientPhotos
      let index = event.currentTarget.dataset.index;
      wx.previewImage({
        current: index,
        urls: patientPhotos
      })
    },
    /**
     * 点击扩展消息查看处方
     * 跳转处方详情
     */
    handleMsgExt() {
      let guid = this.data.guid ? this.data.guid : e.currentTarget.dataset.id
      wx.navigateTo({
        url: `/pages/inquiry/prescriptionDetails/prescriptionDetails?guid=${guid}`
      })
      getApp().globalData.burySpotSDK.track('action_offlineInquiry_prescriptionClick');
    },
    /**
     * 点击去购药
     */
    goBuyMedicine() {
      console.log('去购药')
      ajax('post', apiUrl.getChatStatus, { inquiryId: this.properties.inquiryInfo.inquiryId }, (res) => {
        if (res.data.code === 0 && res.data.result) {
          let isEffective = res.data.result.isEffective
          let toastText = '处方已核销，无法重复使用'
          if (isEffective === 0) {
            wx.navigateTo({
              url: `/pages/quickConsultation/pages/selectProducts/selectProducts?prescriptionNum=${this.data.prescriptionNum}`
            })
          } else {
            if (isEffective === 2) {
              toastText = '处方已超时，请重新开方'
            }
            wx.showToast({
              title: toastText,
              icon: 'none',
              duration: 2000
            })
          }
        } else {
          wx.showToast({
            title: res.data.msg || "服务器异常请重试...",
            icon: 'none',
            duration: 2000
          })
        }
      })
    },
    /**
     * 获取历史消息
     */
    handleChatHistory(isRefresh) {
      let _this = this
      let toView = ''
      let inquiryId = wx.getStorageSync('inquiryId')
      let params = {
        "endTime": new Date().getTime(),
        "inquiryId": inquiryId,
        "msgFrom": this.properties.inquiryInfo.physicianEasemobId || wx.getStorageSync('physicianEasemobId'),   // 医生环信id
        "msgTo": wx.getStorageSync('userEasemoInfo').easeMoUserId,
        "pageNum": this.data.pageNum,
        "pageSize": 20,
        "sourceType": 1
      }
      ajax2('post', apiUrl.getChatHistory, params, (res) => {
        if (res.data.code === 0 && res.data.result) {
          if (res.data.result.list.length) {
            this.setData({
              isData: true,
              pages: res.data.result.pages
            })
            let arr = res.data.result.list
            if(isRefresh !== 'refresh') {
              arr.reverse()
            } 
            // arr.map((msgItem) => {
            //   msgStorage.saveReceiveMsg(msgItem, JSON.parse(msgItem.msgBodies)[0].type, 'oldMsg');
            // })
            arr.forEach((item, index) => {
              let ele = JSON.parse(item.msgBodies)[0]
              let itemObj = saveReceiveMsg(item, JSON.parse(item.msgBodies)[0].type)
              if (itemObj !== '' && _this.properties.inquiryInfo.inquiryId === itemObj.msg.ext.inquiryId) {
                if (itemObj.msg.ext.rxId) {
                  _this.setData({
                    isMsgImRate: true,
                    guid: itemObj.msg.ext.rxId
                  })
                  if (_this.data.stepActive !== '4') {
                    _this.setData({
                      stepActive: '3'
                    })
                  }
                }
                if (isRefresh !== 'refresh') {
                  _this.data.msgArr.push(itemObj)
                } else {
                  _this.data.msgArr.splice(0, 0, itemObj)
                }
              }
            })
            if (isRefresh !== 'refresh' && _this.data.isMsgImRate) {
              toView = 'rate'
            } else {
              toView = isRefresh !== 'refresh'?_this.data.msgArr[_this.data.msgArr.length - 1].mid:_this.data.msgArr[0].mid
            }
            _this.setData({
              chatMsg: _this.data.msgArr
            }, function() {
              wx.nextTick(() => {
                _this.setData({
                  toView: toView
                })
              })
            })
          } else {
            this.setData({
              isData: false
            })
          }
          console.log('msgmsgmsgmsg', _this.data.chatMsg)
        } else {
          wx.showToast({
            title: res.data.msg || "服务器异常请重试...",
            icon: 'none',
            duration: 2000
          });
        }
      })
    },
    /**
     * 上拉加载历史消息
     */
    refresh() {
      console.log('上拉加载', this.data.isData)
      if (this.data.isData && this.data.pageNum < this.data.pages) {
        this.setData({
          pageNum: this.data.pageNum + 1 
        })
        this.handleChatHistory('refresh')
      }
    },
    /**
     * 渲染消息
     * @param renderableMsg 发送的消息体
     * @param type 消息类型  
     * @param curChatMsg 存储的消息 
     * @param sessionKey 拼接的消息 Key
     * @param isnew 是否是新消息
     */
    renderMsg(renderableMsg, type, curChatMsg, sessionKey, isnew) {
      let _this = this
      // 根据 mid 获得最新发送的消息 curChatMsg
      if (curChatMsg.length > 1) {
        _this.data.chatMsg.map(function (elem, index) {
          curChatMsg.map(function (item, i) {
            if (elem.mid == item.mid) {
              curChatMsg.splice(i, 1)
            }
          })
        })
      }
      // 获取历史消息
      let historyChatMsgs = wx.getStorageSync("rendered_" + sessionKey) || [];
      historyChatMsgs = historyChatMsgs.concat(curChatMsg);
      if (!historyChatMsgs.length) return;
      console.log(isnew)
      console.log(_this.data.chatMsg.concat(curChatMsg))
      if (isnew == 'newMsg') {
        _this.setData({
          chatMsg: _this.data.chatMsg.concat(curChatMsg),
          // 跳到最后一条
          toView: historyChatMsgs[historyChatMsgs.length - 1].mid,
        });
      } else {
        _this.setData({
          chatMsg: historyChatMsgs.slice(-10),
          // 跳到最后一条
          toView: historyChatMsgs[historyChatMsgs.length - 1].mid,
        });
      }

      wx.setStorageSync("rendered_" + sessionKey, historyChatMsgs);

      let chatMsg = wx.getStorageSync(sessionKey) || [];
      chatMsg.map(function (item, index) {
        curChatMsg.map(function (item2, index2) {
          if (item2.mid == item.mid) {
            chatMsg.splice(index, 1)
          }
        })
      })

      wx.setStorageSync(sessionKey, chatMsg);

      _this.data.index = historyChatMsgs.slice(-10).length;

      wx.pageScrollTo({
        scrollTop: 99999,
      })
    },
    // 问诊倒计时
    interrogationCountDown(_leftTime) {
      console.log('lefttime',_leftTime);
      let left = _leftTime;
      this.data.askLeftTimer = setInterval(() => {
        left = left - 1;
        if (left === 300) {
          let tipObj = {
            style: 'timertip'
          }
          let _chatArr = this.data.chatMsg;
          _chatArr.push(tipObj)
          console.log('tip fun msg arr:', _chatArr)
          this.setData({
            chatMsg: _chatArr
          });
          this.showSurplusTip = true;
        }else if (left === 0) {
          // 调用status接口，重新获取状态
          console.log("问诊15分钟结束，msglist");
          this.triggerEvent('noticeRecallInquiryInfo')
          clearInterval(this.data.askLeftTimer)
        }
        // console.log('问诊剩余时间--', left);
      }, 1000);
    },
    // 获取评价
    getRate() {
      let inquiryId = wx.getStorageSync('inquiryId')
      let params = {
        bizId: inquiryId       // 问诊单id
      }
      ajax2('post', apiUrl.getRateStar, params, (res) => {
        if (res.data.code === 0) {
          this.setData({
            rate: res.data.result.star
          })
          if (res.data.result.star > 0) {
            this.setData({
              isMsgImRate: true,
              stepActive: '4'
            })
          }
        }
      })
    },
    // 提交评价
    onSub(e) {
      let inquiryId = wx.getStorageSync('inquiryId')
      let params = {
        bizId: inquiryId,             // 问诊单id
        doctorId: this.properties.inquiryInfo.physicianGuid,      // 医师id
        star: e.detail                                            // 星星等级
      }
      ajax2('post', apiUrl.saveRateStar, params, (res) => {
        if (res.data.code === 0) {
          if (res.data.result) {
            this.setData({
              rate: e.detail,
              stepActive: '4'
            })
          }
        }
      })
    },
    clearLeftTimer() {
      clearInterval(this.data.askLeftTimer)
      this.data.askLeftTimer = null;
      console.log('自定义清除定时器方法被执行，用户退出或隐藏')
    },
    handleGetPurchaseBanner() {
      ajax2('get', apiUrl.getPurchaseBanner, { adType: 8 }, res => {
        if (res.data.code === 0) {
          if (res.data.result.length) {
            this.setData({
              bannerImage: res.data.result[0].bannerImage,
              bannerUrl: res.data.result[0].bannerUrl
            })
          }
        } else {
          wx.showToast({
            title: res.data.msg || "服务器异常请重试...",
            icon: 'none',
            duration: 2000
          });
        }
      })
    },
    handleBanner() {
      console.log('handleBanner:', this.data.bannerUrl)
      let bannerUrl = this.data.bannerUrl
      if (bannerUrl) {
        wx.navigateTo({
          url: `../../../../../pages/webView/webView?link=${encodeURIComponent(bannerUrl)}`
        })
        getApp().globalData.burySpotSDK.track('action_offlineInquiry_bannerClick');
      }
    },
    //获取扫码问诊活动弹窗
    getCouponAlert(){
      ajax2('post', 'miniapp/marketing/checkDrugstoreIsTip', {
        organSign: this.properties.inquiryInfo.organSign
      }, res => {
        wx.hideLoading();
        if (res.data.code == 0) {
          this.setData({
            couponAlert: res.data.result,
            couponAlertShow: res.data.result.isTip
          })    
        }else{
          wx.showToast({
            icon: 'none',
            title: res.data.msg
          })
        }
      })
    },
    //点击优惠券弹窗跳转
    jumpLink(){
      wx.navigateTo({
        url: `/pages/inquiry/inquiryActive/inquiryActive?organSign=${ this.properties.inquiryInfo.organSign }`,
      })
    },
    windowClose(){
      this.setData({
        couponAlertShow: false
      })
    },
    // 去绿地小程序
    toOtherApplets() {
      wx.navigateToMiniProgram({
        appId: 'wx2cd69559ff53b837', // 小程序id
        path: `/pages/order_details/stay?order_id=${this.data.thirdOrderNo}&recipe_status=${this.data.prescribeStatus}&prescribePic=${this.data.prescribePic}`,
        // 全局参数
        extraData: {
          // foo: 'bar'
        },
        envVersion: 'release', // develop-开发版 trial-体验版 release-正式版
        success() {
          console.log('绿地小程序跳转成功')
        },
        fail(){
          console.log('绿地小程序跳转失败')
        }
      })
    },
    // 返回购药跳转绿地
    backBuyDrugs: throttle((that, e) => {
      console.log('......返回购药是否开处方', that.data.prescribeStatus)
      if (that.data.prescribeStatus) {
        let params = {guid: that.data.prescriptionNum}
        wx.showLoading({
          title: '加载中...'
        })
        ajax2('get', apiUrl.getPrescriptionSrc, params, res => {
          if (res.data.code === 0) {
            wx.hideLoading()
            if (res.data.result) {
              let src = res.data.result.inquiryPrescription.prescriptionImage
              console.log('...........src', src)
              that.setData({
                prescribePic: src
              },function (){
                that.toOtherApplets()
              })
            }
          } else {
            wx.hideLoading()
            wx.showToast({
              title: res.data.msg || "服务器异常请重试",
              icon: 'none',
              duration: 2000
            });
          }
        })
      } else {
        that.toOtherApplets()
      }
    })
  }
});

