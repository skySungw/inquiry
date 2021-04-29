import { ajax, ajax2, cdnStaticResourceUrl, inquiryOrderPay } from '../../../utils/util'
import { initJump, handleToWaiting, handleToUnload } from "../../../common/toChatroom"
let inquiryReportGuid
Page({

  /**
   * 页面的初始数据
   */
  data: {
    patientList: [],
    haveIdCardPatientList: [], // 有身份证号的列表
    patientListShow: false,
    editPatient: false,
    currentStep: 1,
    scrollHeight: '',
    textareaShow: false,
    patientData: {},
    checkboxData: [],
    radioChangeData: 0,
    scorllBottom: 'msg0',
    textareaValue: '',
    inquiryBoxShow: false,
    guidanceList: [],
    guidanceData: [],
    waitingBoxShow: false,
    payInfo: {},
    args: {
      fee: 0.01,             // 支付金额，单位为分
      paymentArgs: 'A', // 将传递到功能页函数的自定义参数
      currencyType: 'CNY' // 货币符号，页面显示货币简写 US$ 
    },
    createInquiryTime: null,
    patientSex: {
      '0': '未知',
      '1': '男',
      '2': '女'
    },
    cf_chapter: cdnStaticResourceUrl,
    inquirySource: 1,
    supportCode: '',//保险来源加密code
    policyDutyCode: '',//宜块钱解析保险加密code
    couponsNotifyShow: true,
    couponsNotify: {},
    couponsList: [],
    selectCoupon: {},
    couponsDialog: false,
    selectedCoupon: {},
    isRefresh: true,//判断onshow 是否执行
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('guidance onLoad', options)
    if(options.userInfo) {
      console.log(JSON.stringify(options.userInfo))
      let { organSignValid } = JSON.parse(options.userInfo);

      // 扫码问诊用到
      if (organSignValid) {
        wx.showToast({
          icon: 'none',
          title: '店内问诊套餐失效，已帮您安排线上问诊服务',
          duration: 4000
        })
      }
    }

    if(options.inquirySource) this.data.inquirySource = options.inquirySource;
    if(options.supportCode ) this.data.supportCode = options.supportCode;
  },
  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log('guidance onShow')
    //吊起支付触发onshow的情况不刷新
    if(!this.data.isRefresh) return false;

    this.setData({
      currentStep: 1,
      guidanceData: [],
      guidanceList: [],
      inquiryBoxShow: false
    })
    if(this.data.supportCode) {
      this.parseSupportCode();
    }else {
      this.getguidanceData();
    }
    this.getCouponsNotify();
    wx.setStorageSync('guidance', true)
    initJump(this.handleToChatroom)
  },
  onReady: function () {
    console.log('guidance onReady')
  },
  //获取优惠券通知列表
  getCouponsNotify() {
    ajax2('post', 'miniapp/marketing/pushAndGetDiagnosisCouponList', {
      position: 1, //1.问诊首页发券 后台要求写死，便于后期扩展
      channel: getApp().globalData.inquiryChannel//0：扫码购 1：平台（荷叶健康） 2：药店 3：保险 4：您健康
    }, res => {
      if(res.data.code == 0) {
        this.setData({
          couponsNotify: res.data.result
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
  getCouponsList() {
    ajax2('post', 'couponController/queryAvailableCoupons', {
      storeId: this.data.inquiryData.drugstoreId,
      products: [{
        productId: this.data.inquiryData.skuId,
        count: 1
      }]
    }, res => {
      if(res.data.code == 0) {
        let couponsList = res.data.result;
        //默认选择优惠最大的券
        if(couponsList.length > 0 && couponsList[0].defaultOption == 1) this.getDiscountAmount(couponsList[0]);
        this.setData({
          couponsList
        })
      }else {
        wx.showToast({
          title: res.data.msg,
          icon: 'none'
        })
      }
    })
  },
  /**
   * 解析保险来源SupportCode
   */
  parseSupportCode(){
    ajax('POST', 'api/insurance/parseSupportCode', {
      supportCode: this.data.supportCode
    }, res=> {
      if (res.data.code == 0) {
        this.data.policyDutyCode = res.data.result && res.data.result.policyDutyCode;
        this.getInsuUserPatienInfo();
      }else {
        wx.showToast({
          icon: 'none',
          title: res.data.msg
        })
      }
    })
  },
  /**
   * 获取保险用药人
   */
  getInsuUserPatienInfo(){
    ajax('POST', 'api/insurance/getInsuUserPatienInfo', {
      policyDutyCode: this.data.policyDutyCode
    }, res=> {
      if (res.data.code == 0) {
        this.data.patientData = res.data.result;
        this.getguidanceData();
      }else {
        wx.showToast({
          icon: 'none',
          title: res.data.msg
        })
      }
    })
  },
  getguidanceData() {
    ajax2('POST', 'api/extremeInterrogation/leadingExaminingRecords', {}, res=> {
      if (res.data.code == 0) {
        let guidanceData = res.data.result;
        let guidanceList = [];
        guidanceList.push(guidanceData[0]);
        guidanceList.push(guidanceData[1]);
        //保险来源自带用药人，跳过选择用药人步骤
        if(this.data.inquirySource ==5) {
          guidanceList.push({
            userData: this.data.patientData,
            selectedDate: {
              'msg': this.data.patientData && this.data.patientData.patientName
            }
          });
          guidanceList.push(guidanceData[2]);
          this.data.currentStep = 2;
        }else {
          this.getPatientList();
        }
        this.setData({
          guidanceData,
          guidanceList,
          currentStep: this.data.currentStep
        })
        this.computeScrollViewHeight();
      }else {
        wx.showToast({
          icon: 'none',
          title: res.data.msg
        })
      }
    })

  },
  dialogClose(){
    this.setData({
      editPatient: false
    })
  },
  /**
   * @description: 确认是否删除患者
   * @return: void
   */
  checkDeletePatient(e) {
    let patient = e.currentTarget.dataset.item;
    // if (patient.checked) {
    //   wx.showToast({
    //     icon: 'none',
    //     title: '已选中患者无法删除'
    //   })
    //   return false;
    // }
    wx.showModal({
      content: '删除当前患者信息？',
      // confirmColor: getApp().globalData.mainColor,
      success: (res) => {
        if (res.confirm) {
          this.deletePatient(patient);
        }
      }
    })
  },
  /**
   * @description: 删除患者
   * @return: void
   */
  deletePatient(patient) {

    ajax2('POST', 'api/userPatient/deleteUserPatient', {
      id: patient.id,
      userId: wx.getStorageSync('userInfo').userId
    }, res=> {
      if (res.data.code == 0) {
        wx.showToast({
          icon: 'none',
          title: res.data.msg
        })
        this.getPatientList();
        
      }else {
        wx.showToast({
          icon: 'none',
          title: res.data.msg,
        })
      }
    })

  },
  /**
   * @description: 获取患者列表
   * @return: void
   */
  getPatientList() {

    ajax2('POST', 'api/userPatient/selectUserPatientList', {
      userId: wx.getStorageSync('userInfo').userId
    }, (res) => {
      if (res.data.code == 0) {
        // res.data.result.map(item => {
        //   return item.checked = true && item.id == this.data.currentPatientId
        // })
        let _retList = res.data.result.filter(function(item){
          return item.patientIDCard && item.patientIDCard.length !== 0;
        })
        this.setData({
          patientList: res.data.result,
          haveIdCardPatientList: _retList
        })
      } else {
        wx.showToast({
          icon: 'none',
          title: res.data.msg,
        })
      }
    })

  },
  /**
   * @description: 展示患者列表弹窗
   * @return: void
   */
  openPatientList() {
    if(this.data.patientList.length == 0) {
      this.data.editPatient= true;
    }
    this.setData({
      patientListShow: true,
      editPatient: this.data.editPatient
    })
  },
  /**
   * @description: 多选
   * @return: void
   */
  checkboxChange(e) {
    console.log(e)
    let itSomethingElse = false;
    let selectedList = [];
    let currentData = this.data.guidanceData[this.data.currentStep];
    
    this.data.checkboxData = e.detail.value;
    currentData.labelList.forEach(item=> item.checked = false);
    selectedList = currentData.labelList.filter(item=> this.data.checkboxData.some(code => code == item.code));
    selectedList.forEach(item => {
      item.checked = true;
      if(item.itSomethingElse) itSomethingElse = true;//选中的tag是其他
    })
    
    this.setData({
      checkboxData: e.detail.value,
      guidanceData: this.data.guidanceData,
      textareaShow: itSomethingElse
    })
  },
  /**
   * @description: 单选
   * @return: void
   */
  radioChange(e) {
    let currentData = this.data.guidanceData[this.data.currentStep];
    currentData.labelList.forEach(item=> item.checked = false);
    currentData.labelList[e.detail.value].checked = true;
    this.setData({
      radioChangeData: e.detail.value,
      guidanceData: this.data.guidanceData
    })
  },
  /**
   * @description: 确定选项
   * @return: void
   */
  checkValue(e) {
    let index = e.currentTarget.dataset.index;
    let selectedDate = {
      msg: ''
    };
    let hasSomethingElse = false;
    let currentData = this.data.guidanceData[index-1];

    //多选
    if(this.data.guidanceList[index].whetherAlternative) {
      let checkedList = [];
      if(this.data.checkboxData.length == 0) {
        wx.showToast({
          title: '请至少选择一项',
          icon: 'none'
        })
        return;
      }

      checkedList = JSON.parse(JSON.stringify(currentData.labelList.filter(label=> this.data.checkboxData.some(item=> item == label.code))));
      checkedList.forEach((item, index)=> {
        if(item.itSomethingElse) {
          item.msg = this.data.textareaValue;
          hasSomethingElse = true;
        }
        selectedDate.msg += (index == 0 ? item.msg : `，${ item.msg }`);
      })
    }else {
      let hasCheckedIndex = -1;
      currentData.labelList.forEach((item, index)=> {
        if(item.checked) hasCheckedIndex = index;
      })
      this.data.radioChangeData = hasCheckedIndex;

      if(this.data.radioChangeData < 0) {
        wx.showToast({
          title: '请选择如下选项',
          icon: 'none'
        })
        return;
      }

      selectedDate = currentData.labelList[this.data.radioChangeData];
    }

    //包含其他输入框内容必填
    if(hasSomethingElse && !this.data.textareaValue) {
      wx.showToast({
        title: '请输入其他信息',
        icon: 'none'
      })
      return;
    }

    this.data.guidanceList.push({
      userData: this.data.patientData,
      selectedDate
    });

    if(index < this.data.guidanceData.length) {
      this.data.currentStep = index++;
      this.data.guidanceList.push(this.data.guidanceData[this.data.currentStep]);
    }else {
      this.getInquiryData();
      this.setData({
        inquiryBoxShow: true
      })
    }
    
    this.setData({
      currentStep: this.data.currentStep,
      guidanceList: this.data.guidanceList, 
      scorllBottom: `msg${ this.data.guidanceList.length - 1 }`,
      radioChangeData: this.data.radioChangeData
    })
    this.computeScrollViewHeight();
  },
  /**
   * @description: 获取Textarea值
   * @return: void
   */
  getTextareaValue(e) {
    this.setData({
      textareaValue: e.detail.value
    })
  },
  /**
   * @description: 添加/编辑患者信息
   * @return: void
   */
  toPatientInfo(e) {
    let currentPatientId = e.currentTarget.dataset.id || '';
    console.log(currentPatientId)
    if(this.data.patientList.length >= 10 && !currentPatientId) {
      wx.showToast({
        icon: 'none',
        title: '添加患者不得超过10个'
      })
      return false;
    }
    this.setData({
      editPatient: true,
      currentPatientId
    })
  },
  toLogin(){
    wx.navigateTo({
      url: '/pages/note/login/login',
    })
  },
  updataSuccess(){
    console.log(33);
    this.getPatientList();
    this.setData({
      patientListShow: true,
      editPatient: false
    })
  },
  /**
   * @description: 选择患者
   * @return: void
   */
  selectedPatient(e){
    console.log('select--', e.currentTarget.dataset.item);
    let _pidcard = e.currentTarget.dataset.item.patientIDCard;
    if (_pidcard.length == 0) {
      console.log('用户没有身份证号');
      let currentPatientId = e.currentTarget.dataset.item.id || '';
      console.log(currentPatientId)
      this.setData({
        editPatient: true,
        currentPatientId
      })
      return;
    }
    let item = e.currentTarget.dataset.item;
    this.data.guidanceList.push({
      userData: item,
      selectedDate: {
        msg: item.patientName
      }
    });
    this.data.guidanceList.push(this.data.guidanceData[2]);
    this.setData({
      guidanceList: this.data.guidanceList,
      patientListShow: false,
      currentStep: 2,
      patientData: item
    })
  },
  //计算 scroll-view 的高度
  computeScrollViewHeight() {
    //获取屏幕可用高度
    let screenHeight = wx.getSystemInfoSync().windowHeight;
    let query = wx.createSelectorQuery().in(this);
    console.log(query.select('#bottom-box').boundingClientRect())
    query.select('#bottom-box').boundingClientRect((target) => {
      console.log(target)
      let scrollHeight;
      if (target) {
        //计算 scroll-view 的高度
        scrollHeight = screenHeight - target.height;
        
      }else {
        scrollHeight = screenHeight
      }
      this.setData({
        scrollHeight
      })
    }).exec()
  },
  /**
   * @description: 获取问诊卡片
   * @return: void
   */
  getInquiryData() {
    ajax('POST', 'api/extremeInterrogation/channelLabel', {
      thirdChannel: getApp().globalData.inquiryChannel//渠道code 1:平台 2 药店 3 保险 4 您健康
    }, res=> {
      if (res.data.code == 0) {
        res.data.result.askDoctorsPrice = res.data.result.askDoctors;
        this.setData({
          inquiryData: res.data.result
        })
        this.getCouponsList();
      }else {
        wx.showToast({
          icon: 'none',
          title: res.data.msg
        })
      }
    })
  },
  /**
   * @description: 创建问诊单
   * @return: void
   */
  createInquiry() {
    if (new Date().getTime() - this.data.createInquiryTime < 4000) {
      return false;
    }
    this.data.createInquiryTime = new Date().getTime();

    wx.showLoading({
      title: '加载中...'
    })
    let data = {
      orderNo: '',
      userPatientId: this.data.inquirySource == 5 ? this.data.patientData.thirdUserId : this.data.patientData.id,
      inquiryDeptCode: this.data.guidanceList[8].selectedDate.code,
      inquiryDeptName: this.data.guidanceList[8].selectedDate.msg,
      lastDiagnosis: {
        "mainSuit": this.data.guidanceList[4].selectedDate.msg,
        "offlineDiagnosis": this.data.guidanceList[6].selectedDate.code,
        "prescriptionDetail":[],
        "diagnosis":"",
        "diagnosisCode":""
      },//mainSuit offlineDiagnosis 未必传，后面3个参数后台要求写死
      inquirySource: getApp().globalData.inquirySource || this.data.inquirySource,
      thirdChannel: this.data.policyDutyCode,
      inquiryChannel: getApp().globalData.inquiryChannel,
      drugstoreId: this.data.inquiryData.drugstoreId,
      clientType: 10//0未定义，10小程序，20支付宝，30app（iOS），40app(androd),50pc,60H5
    }
    if(this.data.selectedCoupon.id) data.couponIds = [this.data.selectedCoupon.id];

    data.lastDiagnosis = JSON.stringify(data.lastDiagnosis);

    ajax2('POST', 'api/extremeInterrogation/createPrescription', data, res=> {
      wx.hideLoading();
      if (res.data.code == 0) {
        //判断是否需要支付
        if(res.data.result.channelPrice == 0) {
          //免费问诊
          this.paymentSuccess(res.data.result)
        }else {
          //支付
          this.inquiryOrderPay(res.data.result);
        }
      }else {
        wx.showToast({
          icon: 'none',
          title: res.data.msg
        })
      }
    })
  },
  //问诊订单支付
  inquiryOrderPay(data) {
    let param = {
      orderNo: data.orderNo,
      drugstoreId: this.data.inquiryData.drugstoreId
    }
    inquiryOrderPay(param, () => {
      //支付成功
      this.data.isRefresh = false; //吊起支付的情况不刷新页面
      this.paymentSuccess(data);
    }, ()=> {
      //支付失败
      setTimeout(()=> {
        this.paymentFailed();
      }, 500) 
    })
  },
  /**
   * 支付后跳转页面
   */
  paymentSuccess(data){
    this.setData({
      waitingBoxShow: true,
      inquiryBoxShow: false
    })
    let patientGuid = data && data.patientGuid;
    inquiryReportGuid = data && data.inquiryReportGuid;
    wx.setStorageSync('inquiryId', inquiryReportGuid)
    handleToWaiting({ patientGuid })
  },
  // 支付失败的回调接口
  paymentFailed: function (e) {
    wx.redirectTo({
      url: `/pages/note/inquiryRecord/inquiryRecord`
    })
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
  onUnload: function () {
    console.log('guidance onUnload')
    handleToUnload()
  },
  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    console.log('guidance onHide')
    this.data.isRefresh = true;
  },
  // 打开选择优惠券弹窗
  openCouponsBox() {
    if(this.data.couponsList.length == 0) return;
    this.setData({
      couponsDialog: true
    })
  },
  // 选择优惠券
  userCoupon(e){
    this.getDiscountAmount(e.detail);
    
    this.setData({
      couponsDialog: false
    })
  },
  //计算优惠金额
  getDiscountAmount(selectedCoupon) {
    this.data.inquiryData.askDoctorsPrice = this.data.inquiryData.askDoctors;
    if(selectedCoupon.id) {
      selectedCoupon.actualDiscountDes = (selectedCoupon.actualDiscount/100).toFixed(2);
      this.data.inquiryData.askDoctorsPrice = (this.data.inquiryData.askDoctors - selectedCoupon.actualDiscountDes).toFixed(2);
    }
    
    this.setData({
      selectedCoupon,
      inquiryData: this.data.inquiryData
    })
    //初始化数据
    // this.data.discountAmount = null;
    // this.data.inquiryData.askDoctorsPrice = this.data.inquiryData.askDoctors;

    // let askDoctorsPrice = this.data.inquiryData.askDoctors;

    //优惠方法:1:满减;2:折扣;
    // if(selectedCoupon.couponDiscountWay == 1) {
    //   this.data.discountAmount = askDoctorsPrice - (askDoctorsPrice - selectedCoupon.couponCash);
    //   this.data.inquiryData.askDoctorsPrice = askDoctorsPrice - selectedCoupon.couponCash;
    // }else if(selectedCoupon.couponDiscountWay == 2){
    //   let discountPrice= (askDoctorsPrice * selectedCoupon.couponDiscountFactor).toFixed(2);
    //   this.data.discountAmount = askDoctorsPrice - discountPrice;
    //   this.data.inquiryData.askDoctorsPrice = discountPrice;
    // }
  },
  // 关闭优惠券通知弹窗
  //向用户发起订阅请求
  couponsNotifyClose() {
    this.setData({
      couponsNotifyShow: false
    })
    let tmplIds = ['osYBy0kFCHt6qiQd0xb2valQr6rr3afPxYja_y6ZztA'];
    if(!wx.requestSubscribeMessage) return;
    wx.requestSubscribeMessage({
      tmplIds: tmplIds,
      success (res) { 
        ajax('get', 'api/wechat/saveSubscribeUser', {
          templateId: tmplIds[0],
          status: res && res[tmplIds[0]]
        }, res1 => {
          console.log('订阅结果上报', res, res1)
        })
      }
    })
  }
})