import jsPDF from 'jspdf';

export interface PDFReportData {
  patientInfo: {
    name?: string;
    age: number;
    sex: string;
    setting: string;
    clinician_role: string;
    clinical_notes: string;
    encounter_date?: string;
  };
  codes: {
    item_number: string;
    title: string;
    confidence: number;
    reasoning: string;
    evidence: string[];
    schedule_fee?: number;
  }[];
  metadata: {
    generated_date: string;
    generated_by: string;
    analysis_version: string;
  };
}

export class PDFGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageHeight: number = 297; // A4 height in mm
  private margin: number = 20;

  constructor() {
    this.doc = new jsPDF();
  }

  generateReport(data: PDFReportData): Uint8Array {
    this.addHeader();
    this.addPatientInformation(data.patientInfo);
    
    // Check if we need a new page
    if (this.currentY > 200) {
      this.doc.addPage();
      this.currentY = 20;
    }
    
    this.addMBSCodes(data.codes);
    this.addFooter(data.metadata);
    
    return this.doc.output('arraybuffer') as Uint8Array;
  }

  private addHeader() {
    // Company branding
    this.doc.setFontSize(24);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(41, 128, 185); // Blue color
    this.doc.text('AutoMBS', this.margin, this.currentY);
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);
    this.doc.text('AI-Powered Medicare Benefits Schedule Analysis', this.margin, this.currentY + 8);
    
    // Report title
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.currentY += 25;
    this.doc.text('MBS Coding Analysis Report', this.margin, this.currentY);
    
    // Date and time
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(100, 100, 100);
    const now = new Date().toLocaleString('en-AU', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.doc.text(`Generated: ${now}`, this.margin, this.currentY + 8);
    
    this.currentY += 25;
    this.addSeparatorLine();
  }

  private addPatientInformation(patientInfo: PDFReportData['patientInfo']) {
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Patient Information', this.margin, this.currentY);
    this.currentY += 10;

    const infoItems = [
      { label: 'Patient Name', value: patientInfo.name || 'Not provided' },
      { label: 'Age', value: `${patientInfo.age} years` },
      { label: 'Sex', value: patientInfo.sex },
      { label: 'Setting', value: patientInfo.setting },
      { label: 'Clinician Role', value: patientInfo.clinician_role },
      { label: 'Encounter Date', value: patientInfo.encounter_date || 'Not specified' }
    ];

    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'normal');

    infoItems.forEach(item => {
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`${item.label}:`, this.margin, this.currentY);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(item.value, this.margin + 40, this.currentY);
      this.currentY += 7;
    });

    this.currentY += 5;
    
        // Clinical Notes section - FIXED formatting
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Clinical Notes:', this.margin, this.currentY);
    this.currentY += 8;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);

    // Use proper text wrapping without splitTextToSize
    const cleanText = patientInfo.clinical_notes.replace(/\s+/g, ' ').trim();
    const clinicalMaxLineWidth = 150;
    const clinicalWords = cleanText.split(' ');
    let clinicalCurrentLine = '';

    // Check if we need a new page
    if (this.currentY + 30 > 250) {
      this.doc.addPage();
      this.currentY = 20;
    }

    for (const word of clinicalWords) {
      const testLine = clinicalCurrentLine + (clinicalCurrentLine ? ' ' : '') + word;
      const lineWidth = this.doc.getTextWidth(testLine);
      
      if (lineWidth > clinicalMaxLineWidth && clinicalCurrentLine) {
        this.doc.text(clinicalCurrentLine, this.margin, this.currentY);
        this.currentY += 5;
        clinicalCurrentLine = word;
        
        // Check for page break
        if (this.currentY > 250) {
          this.doc.addPage();
          this.currentY = 20;
        }
      } else {
        clinicalCurrentLine = testLine;
      }
    }

    // Print final line
    if (clinicalCurrentLine) {
      this.doc.text(clinicalCurrentLine, this.margin, this.currentY);
      this.currentY += 5;
    }

    this.currentY += 8;
    
    this.addSeparatorLine();
  }

  private addMBSCodes(codes: PDFReportData['codes']) {
    // Check if we need a new page
    if (this.currentY > 200) {
      this.doc.addPage();
      this.currentY = 20;
    }

    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('AI-Generated MBS Codes', this.margin, this.currentY);
    this.currentY += 15;

    codes.forEach((code, index) => {
      // Check if we need a new page for this code
      if (this.currentY > 240) {
        this.doc.addPage();
        this.currentY = 20;
      }

      // Code header box
      this.doc.setFillColor(245, 245, 245);
      this.doc.rect(this.margin, this.currentY - 5, 170, 12, 'F');
      
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(41, 128, 185);
      this.doc.text(`CODE: ${code.item_number}`, this.margin + 5, this.currentY + 3);
      
      // Confidence score
      const confidencePercent = Math.round(code.confidence * 100);
      const confidenceText = `CONF: ${confidencePercent}%`;
      const confidenceWidth = this.doc.getTextWidth(confidenceText);
      this.doc.text(confidenceText, 190 - confidenceWidth - 5, this.currentY + 3);
      
      this.currentY += 15;

      // Title - FIXED formatting
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(0, 0, 0);
      this.doc.text('TITLE:', this.margin, this.currentY);
      this.currentY += 6;
      
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(10);
      
      // Clean and wrap title properly
      const titleText = code.title.replace(/\s+/g, ' ').trim();
      const titleWords = titleText.split(' ');
      let titleCurrentLine = '';
      const titleMaxWidth = 150;

      for (const word of titleWords) {
        const testLine = titleCurrentLine + (titleCurrentLine ? ' ' : '') + word;
        const textWidth = this.doc.getTextWidth(testLine);

        if (textWidth > titleMaxWidth && titleCurrentLine) {
          this.doc.text(titleCurrentLine, this.margin, this.currentY);
          this.currentY += 4.5;
          titleCurrentLine = word;
        } else {
          titleCurrentLine = testLine;
        }
      }

      if (titleCurrentLine) {
        this.doc.text(titleCurrentLine, this.margin, this.currentY);
        this.currentY += 4.5;
      }

      this.currentY += 6;

      // Schedule Fee
      if (code.schedule_fee) {
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('SCHEDULE FEE:', this.margin, this.currentY);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`$${code.schedule_fee.toFixed(2)}`, this.margin + 45, this.currentY);
        this.currentY += 8;
      }

      // Reasoning - FIXED formatting with safety check
      if (code.reasoning && code.reasoning.trim()) {
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('WHY:', this.margin, this.currentY);
        this.currentY += 6;
        
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(10);
        
        // Clean and wrap reasoning text properly
        const reasoningText = code.reasoning.replace(/\s+/g, ' ').trim();
        const reasoningWords = reasoningText.split(' ');
        let reasoningCurrentLine = '';
        const reasoningMaxWidth = 150;

      for (const word of reasoningWords) {
        const testLine = reasoningCurrentLine + (reasoningCurrentLine ? ' ' : '') + word;
        const textWidth = this.doc.getTextWidth(testLine);

        if (textWidth > reasoningMaxWidth && reasoningCurrentLine) {
          this.doc.text(reasoningCurrentLine, this.margin, this.currentY);
          this.currentY += 4.5;
          reasoningCurrentLine = word;
          
          // Check for page break
          if (this.currentY > 240) {
            this.doc.addPage();
            this.currentY = 20;
          }
        } else {
          reasoningCurrentLine = testLine;
        }
      }

      if (reasoningCurrentLine) {
        this.doc.text(reasoningCurrentLine, this.margin, this.currentY);
        this.currentY += 4.5;
      }

        this.currentY += 6;
      }

      // Evidence with proper page breaks and safety check
      if (code.evidence && code.evidence.length > 0) {
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('EVIDENCE:', this.margin, this.currentY);
        this.currentY += 7;
        
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(10);
        
        code.evidence.forEach(evidence => {
        // Check if we need a new page before adding evidence
        if (this.currentY > 240) {
          this.doc.addPage();
          this.currentY = 20;
        }
        
        // Clean evidence text - remove extra quotes and normalize spaces
        const cleanText = evidence.replace(/["""'']/g, '"').replace(/\s+/g, ' ').trim();
        const evidenceWords = cleanText.split(' ');
        let evidenceCurrentLine = '';
        const evidenceMaxWidth = 140; // Better width for readability
        let isFirstLine = true;
        
        for (const word of evidenceWords) {
          const testLine = evidenceCurrentLine + (evidenceCurrentLine ? ' ' : '') + word;
          const textWidth = this.doc.getTextWidth(testLine);
          
          if (textWidth > evidenceMaxWidth && evidenceCurrentLine) {
            // Print current line
            if (isFirstLine) {
              this.doc.text('•', this.margin + 5, this.currentY);
              this.doc.text(evidenceCurrentLine, this.margin + 12, this.currentY);
              isFirstLine = false;
            } else {
              this.doc.text(evidenceCurrentLine, this.margin + 12, this.currentY);
            }
            this.currentY += 4.5; // Tighter line spacing
            evidenceCurrentLine = word;
            
            // Check for page break
            if (this.currentY > 240) {
              this.doc.addPage();
              this.currentY = 20;
            }
          } else {
            evidenceCurrentLine = testLine;
          }
        }
        
        // Print final line
        if (evidenceCurrentLine) {
          if (isFirstLine) {
            this.doc.text('•', this.margin + 5, this.currentY);
            this.doc.text(evidenceCurrentLine, this.margin + 12, this.currentY);
          } else {
            this.doc.text(evidenceCurrentLine, this.margin + 12, this.currentY);
          }
          this.currentY += 4.5;
        }
        
          this.currentY += 4; // Space between evidence items
        });

        this.currentY += 10;
      }

      this.currentY += 15;
    });
  }

  private addFooter(metadata: PDFReportData['metadata']) {
    const pageCount = this.doc.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      
      // Footer line
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(this.margin, this.pageHeight - 25, 190, this.pageHeight - 25);
      
      // Footer text
      this.doc.setFontSize(9);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 100, 100);
      
      this.doc.text('AutoMBS - AI-Powered MBS Coding Analysis', this.margin, this.pageHeight - 15);
      this.doc.text(`Generated by: ${metadata.generated_by}`, this.margin, this.pageHeight - 10);
      this.doc.text(`Analysis Version: ${metadata.analysis_version}`, this.margin, this.pageHeight - 5);
      
      // Page number
      this.doc.text(`Page ${i} of ${pageCount}`, 190 - 20, this.pageHeight - 10);
      
      // Disclaimer
      if (i === pageCount) {
        this.doc.setFontSize(8);
        this.doc.text('Disclaimer: This analysis is AI-generated and should be reviewed by qualified medical coding professionals.', this.margin, this.pageHeight - 20);
      }
    }
  }

  private addSeparatorLine() {
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.currentY, 190, this.currentY);
    this.currentY += 10;
  }
}

export function generateMBSReport(data: PDFReportData): Uint8Array {
  const generator = new PDFGenerator();
  return generator.generateReport(data);
}
