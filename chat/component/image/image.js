let WebIM = wx.WebIM = require("../../../../../im/utils/WebIM")["default"];
Component({
  properties: {
    userInfo: {
      type: Object,
      value: {},
    },
    chatType: {
      type: String,
      value: 'singleChat',
    },
    inquiryInfo: {
      type: Object,
      value: {}
    }
  },
  data: {
    allowType: {
      jpg: true,
      gif: true,
      png: true,
      bmp: true
    }
  },
  methods: {

    /**
     *  调用 wx api 打开相册功能
     */
    sendImage() {
      let _this = this;
      wx.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album"],
        success(res) {
          // 上传图片
          _this.getImageInfo(res);
        }
      });
    },
    /**
     * 获取信息
     * @params { res }  图片信息 
     */
    getImageInfo(res) {
      let _this = this;
      // 获得临时路径
      let tempFilePaths = res.tempFilePaths;
      console.log(tempFilePaths)
      // 获取图片信息
      wx.getImageInfo({
        src: tempFilePaths[0],
        success(res) {

          let index = res.path.lastIndexOf(".");
          let filetype = (~index && res.path.slice(index + 1)) || "";
          if (filetype.toLowerCase() in _this.data.allowType) {
            _this.setUploadImage(res, tempFilePaths, filetype);
          }
        }
      });
    },
    /**
     * 上传选择的图片
     */
    setUploadImage(res, tempFilePaths, filetype) {
      let _this = this;
      // 获取 im accessToken
      let token = WebIM.conn.context.accessToken;
      // 获取 im appkey
      let str = WebIM.config.appkey.split("#");
      // 图片信息
      let width = res.width;
      let height = res.height;
      // uploadUrl 
      let uploadUrl = "https://a1.easemob.com/" + str[0] + "/" + str[1] + "/chatfiles";
      console.log('www imageMsg:', uploadUrl)
      console.log('www imageMsg:', tempFilePaths[0])
      console.log('www imageMsg:', token)
      // 调用 wx 上传 API
      wx.uploadFile({
        url: uploadUrl,
        filePath: tempFilePaths[0],
        name: "file",
        header: {
          "Content-Type": "multipart/form-data",
          Authorization: "Bearer " + token
        },
        success(res) {
          console.log('www imageMsg:', res)
          // 当前用户信息
          let userInfo = wx.getStorageSync("userInfo");
          // 医生信息
          // let doctorInfo = wx.getStorageSync("doctorInfo");
          // 参数配置
          let dataObj = JSON.parse(res.data);
          let id = WebIM.conn.getUniqueId();
          let apiURL = WebIM.config.apiURL;
          let msg = new WebIM.message('img', id);
          let chatType = _this.data.chatType;
          let url = dataObj.uri + "/" + dataObj.entities[0].uuid;

          // 设置消息
          msg.set({
            apiUrl: apiURL,
            body: {
              type: 'img',
              size: {
                width: width,
                height: height
              },
              url: url,
              filetype: filetype,
              filename: tempFilePaths[0]
            },
            from: wx.getStorageSync("userEasemoInfo").easeMoUserId,
            to: _this.properties.inquiryInfo.physicianEasemobId || wx.getStorageSync('physicianEasemobId'),
            ext: {
              inquiryId: _this.properties.inquiryInfo.inquiryId,
              sourceType: 1
            },
            roomType: false,
            chatType: chatType,
            success: function () { }
          });
          console.log(msg.body)
          // 发送消息
          WebIM.conn.send(msg.body);

          // 暴露事件
          _this.triggerEvent("newImageMsg", { msg: msg, type: 'img' }, { bubbles: true, composed: true });
        }
      });
    }
  },
});

