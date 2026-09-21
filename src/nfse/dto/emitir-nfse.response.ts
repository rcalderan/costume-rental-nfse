export interface EmitirNfseResponse {
  status: 'AUTHORIZED' | 'PENDING';
  accessKey?: string;
  invoiceNumber?: number;
  series: string;
  protocol: string;
  issueDate?: Date;
  processingDate: Date;
  serviceValue: number;
  authorizedXml?: string;
}
