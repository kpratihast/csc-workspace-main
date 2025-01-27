const { WebcController } = WebCardinal.controllers;
const cscServices = require('csc-services');
const eventBusService = cscServices.EventBusService
const FileDownloaderService = cscServices.FileDownloaderService;
const ShipmentService = cscServices.ShipmentService;
const { shipmentStatusesEnum, shipmentPendingActionEnum } = cscServices.constants.shipment;
const momentService = cscServices.momentService;
const { Commons, FoldersEnum, Topics, Roles } = cscServices.constants;
const statusesService = cscServices.StatusesService;
const KitsService = cscServices.KitsService;

class ViewShipmentBaseControllerImpl extends WebcController{

  constructor(role,...props) {
    super(...props);
    this.role = role;
    this.shipmentService = new ShipmentService(this.DSUStorage);
    this.kitsService = new KitsService(this.DSUStorage);
    this.addedRefreshListeners = false;
    this.FileDownloaderService = new FileDownloaderService(this.DSUStorage);
  }

  navigationHandlers() {
    this.onTagClick('nav-back', () => {
      this.history.goBack();
    });

    this.onTagClick('dashboard', () => {
      this.navigateToPageTag('dashboard', { tab: Topics.Shipment });
    });
  }

  downloadAttachmentHandler() {
    this.onTagClick('download-file', async (model) => {
      const { name, attached_by } = model;
      let keySSI;
      let location = FoldersEnum.Documents;
      switch (attached_by) {
        case Roles.Sponsor: {
          keySSI = this.model.orderModel.order.sponsorDocumentsKeySSI;
          break;
        }
        case Roles.CMO: {
          keySSI = this.model.orderModel.order.cmoDocumentsKeySSI;
          break;
        }
        case Roles.Courier: {
          keySSI = this.model.shipmentModel.shipment.shipmentDocuments;
          location = FoldersEnum.ShipmentDocuments
          break;
        }
      }

      await this.downloadFile(name, location, keySSI);
    });
  }

  downloadKitListHandler() {
    this.onTagClick('download-kits-file', async (order) => {
      const { kitsFilename, kitsSSI } = order;
      await this.downloadFile(kitsFilename, FoldersEnum.Kits, kitsSSI);
    });
  }

  async downloadFile(filename, rootFolder, keySSI) {
    window.WebCardinal.loader.hidden = false;
    const path = rootFolder + '/' + keySSI + '/' + 'files';
    await this.FileDownloaderService.prepareDownloadFromDsu(path, filename);
    this.FileDownloaderService.downloadFileToDevice(filename);
    window.WebCardinal.loader.hidden = true;
  }

  toggleAccordionItemHandler() {
    this.onTagEvent('toggle-accordion', 'click', (model, target) => {
      const targetIcon = target.querySelector('.accordion-icon');
      target.classList.toggle('accordion-item-active');
      targetIcon.classList.toggle('rotate-icon');

      const panel = target.nextElementSibling;
      if (panel.style.maxHeight === '1000px') {
        panel.style.maxHeight = '0px';
      } else {
        panel.style.maxHeight = '1000px';
      }
    });
  }

  openFirstAccordion() {
    const accordion = this.querySelector('.accordion-item');
    const targetIcon = accordion.querySelector('.accordion-icon');
    const panel = accordion.nextElementSibling;

    accordion.classList.toggle('accordion-item-active');
    targetIcon.classList.toggle('rotate-icon');
    panel.style.maxHeight = '1000px';
  }

  showHistoryHandler() {
    this.onTagEvent('history-button', 'click', () => {
      this.onShowHistoryClick();
    });
  }

  async onShowHistoryClick() {
    let { orderModel, shipmentModel, kitsData } = this.model.toObject();
    
    const historyModel = {
      shipment: shipmentModel.shipment,
      currentPage: Topics.Shipment
    };
    if(orderModel){
      historyModel.order = orderModel.order
    }

    //only sponsor and site have access to kits dashboard
    if (kitsData && [Roles.Sponsor, Roles.Site].indexOf(this.role) !== -1) {
      try{
        historyModel.kits = await this.kitsService.getOrderKits(orderModel.order.studyId, orderModel.order.orderId);
      }
      catch (e){
        historyModel.kits = []
      }

    }


    this.createWebcModal({
      template: 'historyModal',
      controller: 'HistoryModalController',
      model: historyModel,
      disableBackdropClosing: false,
      disableFooter: true,
      disableExpanding: true,
      disableClosing: false,
      disableCancelButton: true,
      expanded: false,
      centered: true,
    });
  }


  getDateTime(timestamp) {
    return {
      date: momentService(timestamp).format(Commons.YMDDateTimeFormatPattern),
      time: momentService(timestamp).format(Commons.HourFormatPattern)
    };
  }

  transformShipmentData(data) {
    if (data) {
      data.status_value = data.status.sort((function(a, b) {
        return new Date(b.date) - new Date(a.date);
      }))[0].status;
      if (data.status_value === shipmentStatusesEnum.ShipmentCancelled) {
        data.status_value = shipmentStatusesEnum.Cancelled;
      }

      data.status_date = momentService(data.status.sort((function(a, b) {
        return new Date(b.date) - new Date(a.date);
      }))[0].date).format(Commons.DateTimeFormatPattern);

      if(data.deliveryDateTime){
        data.deliveryDateTime = this.getDateTime (data.deliveryDateTime)
      }

      const statuses = statusesService.getShipmentStatusesByRole(this.role);
      const normalStatuses = statuses.normalStatuses;
      const approvedStatuses = statuses.approvedStatuses;
      data.status_approved = approvedStatuses.indexOf(data.status_value) !== -1;
      data.status_cancelled = data.status_value === shipmentStatusesEnum.Cancelled;
      data.status_normal = normalStatuses.indexOf(data.status_value) !== -1;
      data.pending_action = this.getPendingAction(data.status_value);
      data.contextualContent = {
        afterReadyForDispatch: data.status.findIndex(el => el.status === shipmentStatusesEnum.ReadyForDispatch) !== -1,
        afterInTransit: data.status.findIndex(el => el.status === shipmentStatusesEnum.InTransit) !== -1 && data.hasOwnProperty('bill'),
        afterDelivered: data.status.findIndex(el => el.status === shipmentStatusesEnum.Delivered) !== -1,
        afterReceived: data.status.findIndex(el => el.status === shipmentStatusesEnum.Received) !== -1
      };

      return data;
    }

    return {};
  }

  async getShipmentComments(shipment){
    let commentsData = await this.shipmentService.getShipmentComments(shipment.shipmentComments);
    let comments = commentsData.comments;
    comments.forEach((comment) => {
      comment.date = momentService(comment.date).format(Commons.DateTimeFormatPattern);
    });
    return comments;
  }

  async getShipmentDocuments(shipment){
    let documentsData = await this.shipmentService.getShipmentDocuments(shipment.shipmentDocuments);
    documentsData.documents.forEach((doc)=>{
      doc.date = momentService(doc.date).format(Commons.DateTimeFormatPattern);
    });

    return  documentsData.documents;
  }


  attachRefreshListeners() {
    if (!this.addedRefreshListeners) {
      this.addedRefreshListeners = true;
      let modalOpen = false;

      let updateViewHandler = ()=>{
        modalOpen = false;
        this.initViewModel();
      };

      eventBusService.addEventListener(Topics.RefreshShipments + this.model.shipmentModel.shipment.shipmentId, () => {
        if (!modalOpen) {
          modalOpen = true;
          let title = 'Shipment Updated';
          let content = 'Shipment was updated';
          let modalOptions = {
            disableExpanding: true,
            disableClosing: true,
            disableCancelButton: true,
            confirmButtonText: 'Update View',
            id: 'confirm-modal'
          };
          this.showModal(content, title, updateViewHandler, updateViewHandler, modalOptions);
        }
      });
    }
  }


  getPendingAction(status_value) {
    switch (status_value) {
      case shipmentStatusesEnum.InPreparation:
        return shipmentPendingActionEnum.PendingReadyForDispatch;

      case shipmentStatusesEnum.ReadyForDispatch:
        return shipmentPendingActionEnum.PendingPickUp;

      case shipmentStatusesEnum.PickUpAtWarehouse:
        return shipmentPendingActionEnum.PendingInTransit;

      case shipmentStatusesEnum.InTransit:
        return shipmentPendingActionEnum.PendingDelivery;

      case shipmentStatusesEnum.Delivered:
        return shipmentPendingActionEnum.PendingReception;

      case shipmentStatusesEnum.Received:
        return shipmentPendingActionEnum.ManageKits;
    }

    return '-';
  }
}
const controllersRegistry = require('../../ControllersRegistry').getControllersRegistry();
controllersRegistry.registerController('ViewShipmentBaseController', ViewShipmentBaseControllerImpl);
module.exports = ViewShipmentBaseControllerImpl;
