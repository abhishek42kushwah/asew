/**
 * PDF Generator Utility for Quotation Form
 */

export const generateQuotationPDF = (
  formData,
  labEquipment,
  showFields,
  totals,
) => {
  const escapeHtml = (text) => {
    if (!text) return "";
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const formatAddress = (address) => {
    if (!address) return "";
    const parts = address.split(",").map((part) => part.trim());
    let formatted = "";
    let currentLine = "";
    parts.forEach((part) => {
      if (currentLine.length + part.length < 50) {
        currentLine += (currentLine ? ", " : "") + part;
      } else {
        formatted += (formatted ? "<br>" : "") + currentLine;
        currentLine = part;
      }
    });
    if (currentLine) formatted += (formatted ? "<br>" : "") + currentLine;
    return formatted;
  };

  const formatDateForPdf = (dateString) => {
    if (!dateString) return "";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const hasImages = labEquipment.some(
    (item) => item.image && item.image !== "",
  );

  let tableHeaders = `<th>Sr. No.</th><th>Item</th><th>Specifications</th>`;
  if (showFields.make) tableHeaders += `<th>Make</th>`;
  if (showFields.hsn) tableHeaders += `<th>HSN</th>`;
  if (showFields.nabl) tableHeaders += `<th>NABL</th>`;
  tableHeaders += `<th>Qty</th><th>Unit Price</th>`;
  if (showFields.discount) tableHeaders += `<th>Disc %</th>`;
  tableHeaders += `<th>Total Price</th>`;
  if (hasImages) tableHeaders += `<th>Image</th>`;

  const footerImageCellHtml = hasImages ? "<td></td>" : "";
  let baseColSpan = 3;
  if (showFields.make) baseColSpan++;
  if (showFields.hsn) baseColSpan++;
  if (showFields.nabl) baseColSpan++;

  const rowsHtml = labEquipment
    .map((item, index) => {
      let imageHtml = "";
      if (hasImages && item.image) {
        let src = "";
        if (item.image instanceof File || item.image instanceof Blob) {
          src = URL.createObjectURL(item.image);
        } else if (typeof item.image === "string") {
          src = item.image;
        }

        if (src) {
          imageHtml = `<img src="${src}" width="90" height="90" style="object-fit: contain; border: 1px solid #eee; border-radius: 6px;">`;
        }
      }

      const imageCellHtml = hasImages
        ? `<td style="text-align:center; padding: 4px;">${imageHtml}</td>`
        : "";
      const makeCell = showFields.make
        ? `<td>${escapeHtml(item.make)}</td>`
        : "";
      const hsnCell = showFields.hsn ? `<td>${escapeHtml(item.hsn)}</td>` : "";
      const nablCell = showFields.nabl
        ? `<td style="text-align:center;">${escapeHtml(item.nabl)}</td>`
        : "";
      const discCell = showFields.discount
        ? `<td>${parseFloat(item.discount_percent || 0).toFixed(2)}%</td>`
        : "";

      return `
        <tr style="page-break-inside: avoid;">
          <td style="text-align:center;">${index + 1}</td>
          <td style="font-weight: bold; width: 180px;">${escapeHtml(item.item_name)}</td>
          <td style="font-size: 9pt; white-space: pre-wrap;">${escapeHtml(item.specifications)}</td>
          ${makeCell}
          ${hsnCell}
          ${nablCell}
          <td style="text-align:center;">${item.qty}</td>
          <td style="text-align:right;">${item.unit_price.toFixed(2)}</td>
          ${discCell}
          <td style="text-align:right;">${item.total_price.toFixed(2)}</td>
          ${imageCellHtml}
        </tr>
      `;
    })
    .join("");

  const totalQty = labEquipment.reduce(
    (sum, item) => sum + Number(item.qty || 0),
    0,
  );
  const logoUrl = "/asewlogo.jpg"; // Relative to Vite's root (public directory)

  let freightDisplay = "";
  const freightInput = parseFloat(formData.Freight_Charges) || 0;
  const freightNoteText = formData.Freight_Note
    ? escapeHtml(formData.Freight_Note).trim()
    : "";

  if (freightInput > 0) {
    if (formData.FreightType === "%") {
      freightDisplay = freightInput + "%";
    } else {
      freightDisplay = freightInput.toFixed(2);
    }
  }
  if (freightInput > 0 && freightNoteText) {
    freightDisplay += ` <span style="font-size:8pt;">(${freightNoteText})</span>`;
  } else if (freightInput <= 0) {
    freightDisplay = freightNoteText ? freightNoteText : "-";
  }

  let packagingDisplay = "";
  const packagingInput = parseFloat(formData.Packaging_Charges) || 0;
  const packagingNoteText = formData.Packaging_Note
    ? escapeHtml(formData.Packaging_Note).trim()
    : "";

  if (packagingInput > 0) {
    if (formData.PackagingType === "%") {
      packagingDisplay = packagingInput + "%";
    } else {
      packagingDisplay = packagingInput.toFixed(2);
    }
  }
  if (packagingInput > 0 && packagingNoteText) {
    packagingDisplay += ` <span style="font-size:8pt;">(${packagingNoteText})</span>`;
  } else if (packagingInput <= 0) {
    packagingDisplay = packagingNoteText ? packagingNoteText : "-";
  }

  let discountRowHtml = "";
  const discountInput = parseFloat(formData.Discount) || 0;
  if (discountInput > 0) {
    let discountDisplay = "";
    if (formData.DiscountType === "%") {
      discountDisplay = discountInput + "%";
    } else {
      discountDisplay = discountInput.toFixed(2);
    }
    discountRowHtml = `<tr><th>Discount</th><td>${discountDisplay}</td></tr>`;
  }

  const deliveryAddressHtml =
    formData.Delivery_Address && formData.Delivery_Address.trim() !== ""
      ? `<p style="margin-top: 10px;"><strong>Delivery Address:</strong><br>${formatAddress(
          formData.Delivery_Address,
        )}</p>`
      : "";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${escapeHtml(formData.Quotation_No).replace(/\//g, "_") || "Quotation"}</title>
      <style>
        @media print { 
          @page { size: auto; margin: 0mm; }
          body { -webkit-print-color-adjust: exact !important; margin: 0; } 
          .container { width: 100%; margin: 0; padding: 10mm; }
        }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt; color: #333; margin: 20px; line-height: 1.4; }
        .container { width: 95%; margin: auto; }
        .header { display: flex; align-items: center; border-bottom: 3px solid #000000; padding: 20px; margin-bottom: 25px; background-color: #ADD8E6; }
        .logo-container { width: 240px; height: 150px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 6px; padding: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-right: 25px; }
        .logo { max-width: 100%; max-height: 100%; object-fit: contain; }
        .company-info { flex-grow: 1; text-align: left; }
        .company-info h3 { margin: 0 0 5px 0; font-size: 16pt; font-weight: 800; text-transform: uppercase; color: #dc2626; letter-spacing: 0.5px; white-space: nowrap; }
        .company-info p { margin: 2px 0; font-size: 11pt; color: #475569; font-weight: 500; }
        .details { display: flex; justify-content: space-between; margin-bottom: 25px; padding: 15px; background-color: #f1f5f9; border-radius: 8px; }
        .details-left, .details-right { width: 48%; }
        .details-left p, .details-right p { margin: 4px 0; font-size: 10pt; }
        .customer { margin-bottom: 25px; padding: 0 15px; }
        .customer p { margin: 4px 0; font-size: 10pt; color: #1e293b; }
        .quotation-title { text-align: center; font-size: 16pt; font-weight: 800; margin-bottom: 20px; color: #1e293b; text-transform: uppercase; }
        .intro { margin-bottom: 20px; font-size: 10pt; padding: 0 15px; }
        .equipment-title { font-size: 12pt; font-weight: bold; margin-bottom: 15px; color: #334155; }
        table.equipment-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .equipment-table th, .equipment-table td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: left; font-size: 9.5pt; vertical-align: top; }
        .equipment-table th { background-color: #334155; font-weight: bold; color: #ffffff; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 0.5px; }
        .equipment-table tbody tr:nth-child(even) { background-color: #f8fafc; }
        .equipment-table tbody tr:last-child { font-weight: bold; background-color: #e2e8f0; color: #1e293b; }
        .terms { margin-bottom: 25px; page-break-inside: avoid; }
        .terms h3 { font-size: 12pt; font-weight: bold; margin-bottom: 15px; color: #334155; }
        table.terms-table { width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #cbd5e1; }
        .terms-table tr { page-break-inside: avoid; }
        .terms-table th, .terms-table td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: top; text-align: left; }
        .terms-table th { width: 25%; background-color: #f1f5f9; font-weight: bold; color: #475569; }
        .terms-table td { width: 75%; color: #1e293b; }
        .closing { margin-bottom: 30px; font-size: 10pt; padding: 0 15px; page-break-inside: avoid; }
        .footer { text-align: center; border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 40px; font-size: 9pt; display: flex; justify-content: center; gap: 30px; color: #64748b; }
        .footer span { display: flex; align-items: center; gap: 8px; }
        .underline-text { border-bottom: 2px solid #334155; display: inline-block; padding-bottom: 4px;}
      </style>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-container">
            <img src="${logoUrl}" class="logo" alt="ASEW Logo">
          </div>
          <div class="company-info">
            <h3>ASSOCIATED SCIENTIFIC & ENGINEERING WORKS</h3>
            <p>6-Rani Jhansi Road, Motia Khan, New Delhi-110055 (India)</p>
          </div>
        </div>
        <div class="details">
          <div class="details-left">
            <p><strong>ASEW</strong></p>
            <p>Phone: 011-23521188, 23534863</p>
            <p>Insta ID: asewindia</p>
            <p>GST No.: 07AACPC5834E1Z5</p>
          </div>
          <div class="details-right">
            <p><strong>Date:</strong> ${formatDateForPdf(formData.Date)}</p>
            <p><strong>Quotation No.:</strong> ${escapeHtml(formData.Quotation_No)}</p>
          </div>
        </div>
        <div class="customer">
          <p><strong>To,</strong></p>
          <p>${escapeHtml(formData.Customer_Name)}</p>
          <p>${formatAddress(formData.Buyer_Address)}</p>
          ${deliveryAddressHtml}
          <p>Mobile No: ${escapeHtml(formData.Contact_Mobile)}</p>
          <p>Email: ${escapeHtml(formData.Email_Address)}</p>
          <p>Contact Person: ${escapeHtml(formData.Contact_Person)}</p>
        </div>
        <div class="quotation-title"><span class="underline-text">Quotation for Lab Equipment</span></div>
        <div class="intro">
          <p>Dear Sir/Madam,</p>
          <p>Thank you for your valued enquiry. We take great pleasure in submitting our offer, which we hope will meet your kind approval:</p>
        </div>
        <div>
          <div class="equipment-title"><span class="underline-text">List of Lab Equipment</span></div>
          <table class="equipment-table">
            <thead>
              <tr>${tableHeaders}</tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr>
                <td colspan="${baseColSpan}" style="text-align:right;"><strong>Total</strong></td>
                <td style="text-align:center;">${totalQty}</td>
                <td></td> 
                ${showFields.discount ? "<td></td>" : ""} 
                <td style="text-align:right;">${totals.subtotal.toFixed(2)}</td>
                ${footerImageCellHtml}
              </tr>
            </tbody>
          </table>
        </div>
        <div class="terms">
          <h3><span class="underline-text">Terms & Conditions:</span></h3>
          <table class="terms-table">
            ${discountRowHtml}
            <tr><th>Freight</th><td>${freightDisplay}</td></tr>
            <tr><th>Packaging</th><td>${packagingDisplay}</td></tr>
            <tr><th>Tax</th><td>${escapeHtml(formData.Term_Tax || "")}</td></tr>
            <tr><th>Payment</th><td>${escapeHtml(formData.Term_Payment || "")}</td></tr>
            <tr><th>Delivery</th><td>${escapeHtml(formData.Term_Delivery || "")}</td></tr>
            <tr><th>Warranty</th><td>${escapeHtml(formData.Term_Warranty || "").replace(/\n/g, "<br>")}</td></tr>
          
          </table>
        </div>
        <div class="closing">
          <p>Thanking you and awaiting your valued order at your earliest.</p>
          <p>Yours faithfully,</p>
          <p><strong>For Associated Scientific & Engg. Works</strong></p>
        </div>
        <div class="footer">
          <span><strong>Tel:</strong> 9873711119, 9873811119</span>
          <span><strong>Web:</strong> www.asewindia.com</span>
          <span><strong>Email:</strong> sales@asewindia.com</span>
        </div>
      </div>
    </body>
    </html>
  `;

  // Open the printable HTML in a new window/tab
  const printWindow = window.open("", "_blank");
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait a small delay to ensure images load
  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 250);
};

import html2pdf from "html2pdf.js";

/**
 * Silently generates a PDF Blob to be sent to the server.
 */
export const generatePDFBlob = async (
  formData,
  labEquipment,
  showFields,
  totals,
) => {
  return new Promise((resolve, reject) => {
    // We recreate the same HTML logic but without writing to a new window.
    // We create a hidden DOM element instead.

    // (Helper functions)
    const escapeHtml = (text) => {
      if (!text) return "";
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const formatAddress = (address) => {
      if (!address) return "";
      const parts = address.split(",").map((part) => part.trim());
      let formatted = "";
      let currentLine = "";
      parts.forEach((part) => {
        if (currentLine.length + part.length < 50) {
          currentLine += (currentLine ? ", " : "") + part;
        } else {
          formatted += (formatted ? "<br>" : "") + currentLine;
          currentLine = part;
        }
      });
      if (currentLine) formatted += (formatted ? "<br>" : "") + currentLine;
      return formatted;
    };

    const formatDateForPdf = (dateString) => {
      if (!dateString) return "";
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    };

    const hasImages = labEquipment.some(
      (item) => item.image && item.image !== "",
    );

    let tableHeaders = `<th>Sr. No.</th><th>Item</th><th>Specifications</th>`;
    if (showFields.make) tableHeaders += `<th>Make</th>`;
    if (showFields.hsn) tableHeaders += `<th>HSN</th>`;
    if (showFields.nabl) tableHeaders += `<th>NABL</th>`;
    tableHeaders += `<th>Qty</th><th>Unit Price</th>`;
    if (showFields.discount) tableHeaders += `<th>Disc %</th>`;
    tableHeaders += `<th>Total Price</th>`;
    if (hasImages) tableHeaders += `<th>Image</th>`;

    const footerImageCellHtml = hasImages ? "<td></td>" : "";
    let baseColSpan = 3;
    if (showFields.make) baseColSpan++;
    if (showFields.hsn) baseColSpan++;
    if (showFields.nabl) baseColSpan++;

    const rowsHtml = labEquipment
      .map((item, index) => {
        let imageHtml = "";
        if (hasImages && item.image) {
          let src = "";
          if (item.image instanceof File || item.image instanceof Blob) {
            src = URL.createObjectURL(item.image);
          } else if (typeof item.image === "string") {
            src = item.image;
          }
          if (src) {
            imageHtml = `<img src="${src}" width="90" height="90" style="object-fit: contain; border: 1px solid #eee; border-radius: 6px;">`;
          }
        }

        const imageCellHtml = hasImages
          ? `<td style="text-align:center; padding: 4px;">${imageHtml}</td>`
          : "";
        const makeCell = showFields.make
          ? `<td>${escapeHtml(item.make)}</td>`
          : "";
        const hsnCell = showFields.hsn
          ? `<td>${escapeHtml(item.hsn)}</td>`
          : "";
        const nablCell = showFields.nabl
          ? `<td style="text-align:center;">${escapeHtml(item.nabl)}</td>`
          : "";
        const discCell = showFields.discount
          ? `<td>${parseFloat(item.discount_percent || 0).toFixed(2)}%</td>`
          : "";

        return `
          <tr style="page-break-inside: avoid;">
            <td style="text-align:center;">${index + 1}</td>
            <td style="font-weight: bold; width: 180px;">${escapeHtml(item.item_name)}</td>
            <td style="font-size: 9pt; white-space: pre-wrap;">${escapeHtml(item.specifications)}</td>
            ${makeCell}
            ${hsnCell}
            ${nablCell}
            <td style="text-align:center;">${item.qty}</td>
            <td style="text-align:right;">${item.unit_price.toFixed(2)}</td>
            ${discCell}
            <td style="text-align:right;">${item.total_price.toFixed(2)}</td>
            ${imageCellHtml}
          </tr>
        `;
      })
      .join("");

    const totalQty = labEquipment.reduce(
      (sum, item) => sum + Number(item.qty || 0),
      0,
    );
    // Use an absolute URL for the print generator to avoid relative path issues when html2pdf runs
    const logoUrl = window.location.origin + "/asewlogo.jpg";

    let freightDisplay = "";
    const freightInput = parseFloat(formData.Freight_Charges) || 0;
    const freightNoteText = formData.Freight_Note
      ? escapeHtml(formData.Freight_Note).trim()
      : "";
    if (freightInput > 0) {
      freightDisplay =
        formData.FreightType === "%"
          ? freightInput + "%"
          : freightInput.toFixed(2);
    }
    if (freightInput > 0 && freightNoteText) {
      freightDisplay += ` <span style="font-size:8pt;">(${freightNoteText})</span>`;
    } else if (freightInput <= 0) {
      freightDisplay = freightNoteText || "-";
    }

    let packagingDisplay = "";
    const packagingInput = parseFloat(formData.Packaging_Charges) || 0;
    const packagingNoteText = formData.Packaging_Note
      ? escapeHtml(formData.Packaging_Note).trim()
      : "";
    if (packagingInput > 0) {
      packagingDisplay =
        formData.PackagingType === "%"
          ? packagingInput + "%"
          : packagingInput.toFixed(2);
    }
    if (packagingInput > 0 && packagingNoteText) {
      packagingDisplay += ` <span style="font-size:8pt;">(${packagingNoteText})</span>`;
    } else if (packagingInput <= 0) {
      packagingDisplay = packagingNoteText || "-";
    }

    let discountRowHtml = "";
    const discountInput = parseFloat(formData.Discount) || 0;
    if (discountInput > 0) {
      const discountDisplay =
        formData.DiscountType === "%"
          ? discountInput + "%"
          : discountInput.toFixed(2);
      discountRowHtml = `<tr><th>Discount</th><td>${discountDisplay}</td></tr>`;
    }

    const deliveryAddressHtml =
      formData.Delivery_Address && formData.Delivery_Address.trim() !== ""
        ? `<p style="margin-top: 10px;"><strong>Delivery Address:</strong><br>${formatAddress(formData.Delivery_Address)}</p>`
        : "";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(formData.Quotation_No).replace(/\//g, "_") || "Quotation"}</title>
        <style>
          @media print { 
            @page { size: auto; margin: 0mm; }
            body { -webkit-print-color-adjust: exact !important; margin: 0; } 
            .container { width: 100%; margin: 0; padding: 10mm; }
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10pt; color: #333; margin: 20px; line-height: 1.4; }
          .container { width: 95%; margin: auto; }
          .header { display: flex; align-items: center; border-bottom: 3px solid #000000; padding: 20px; margin-bottom: 25px; background-color: #ADD8E6; }
          .logo-container { width: 240px; height: 150px; display: flex; align-items: center; justify-content: center; background: white; border-radius: 6px; padding: 5px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-right: 25px; }
          .logo { max-width: 100%; max-height: 100%; object-fit: contain; }
          .company-info { flex-grow: 1; text-align: left; }
          .company-info h3 { margin: 0 0 5px 0; font-size: 16pt; font-weight: 800; text-transform: uppercase; color: #dc2626; letter-spacing: 0.5px; white-space: nowrap; }
          .company-info p { margin: 2px 0; font-size: 11pt; color: #475569; font-weight: 500; }
          .details { display: flex; justify-content: space-between; margin-bottom: 25px; padding: 15px; background-color: #f1f5f9; border-radius: 8px; }
          .details-left, .details-right { width: 48%; }
          .details-left p, .details-right p { margin: 4px 0; font-size: 10pt; }
          .customer { margin-bottom: 25px; padding: 0 15px; }
          .customer p { margin: 4px 0; font-size: 10pt; color: #1e293b; }
          .quotation-title { text-align: center; font-size: 16pt; font-weight: 800; margin-bottom: 20px; color: #1e293b; text-transform: uppercase; }
          .intro { margin-bottom: 20px; font-size: 10pt; padding: 0 15px; }
          .equipment-title { font-size: 12pt; font-weight: bold; margin-bottom: 15px; color: #334155; }
          table.equipment-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .equipment-table th, .equipment-table td { border: 1px solid #cbd5e1; padding: 10px 8px; text-align: left; font-size: 9.5pt; vertical-align: top; }
          .equipment-table th { background-color: #334155; font-weight: bold; color: #ffffff; text-transform: uppercase; font-size: 8.5pt; letter-spacing: 0.5px; }
          .equipment-table tbody tr:nth-child(even) { background-color: #f8fafc; }
          .equipment-table tbody tr:last-child { font-weight: bold; background-color: #e2e8f0; color: #1e293b; }
          .terms { margin-bottom: 25px; page-break-inside: avoid; }
          .terms h3 { font-size: 12pt; font-weight: bold; margin-bottom: 15px; color: #334155; }
          table.terms-table { width: 100%; border-collapse: collapse; font-size: 10pt; border: 1px solid #cbd5e1; }
          .terms-table tr { page-break-inside: avoid; }
          .terms-table th, .terms-table td { border: 1px solid #cbd5e1; padding: 10px; vertical-align: top; text-align: left; }
          .terms-table th { width: 25%; background-color: #f1f5f9; font-weight: bold; color: #475569; }
          .terms-table td { width: 75%; color: #1e293b; }
          .closing { margin-bottom: 30px; font-size: 10pt; padding: 0 15px; page-break-inside: avoid; }
          .footer { text-align: center; border-top: 2px solid #e2e8f0; padding-top: 20px; margin-top: 40px; font-size: 9pt; display: flex; justify-content: center; gap: 30px; color: #64748b; }
          .footer span { display: flex; align-items: center; gap: 8px; }
          .underline-text { border-bottom: 2px solid #334155; display: inline-block; padding-bottom: 4px;}
        </style>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-container">
              <img src="${logoUrl}" class="logo" alt="ASEW Logo">
            </div>
            <div class="company-info">
              <h3>ASSOCIATED SCIENTIFIC & ENGINEERING WORKS</h3>
              <p>6-Rani Jhansi Road, Motia Khan, New Delhi-110055 (India)</p>
            </div>
          </div>
          <div class="details">
            <div class="details-left">
              <p><strong>ASEW</strong></p>
              <p>Phone: 011-23521188, 23534863</p>
              <p>Insta ID: asewindia</p>
              <p>GST No.: 07AACPC5834E1Z5</p>
            </div>
            <div class="details-right">
              <p><strong>Date:</strong> ${formatDateForPdf(formData.Date)}</p>
              <p><strong>Quotation No.:</strong> ${escapeHtml(formData.Quotation_No)}</p>
            </div>
          </div>
          <div class="customer">
            <p><strong>To,</strong></p>
            <p>${escapeHtml(formData.Customer_Name)}</p>
            <p>${formatAddress(formData.Buyer_Address)}</p>
            ${deliveryAddressHtml}
            <p>Mobile No: ${escapeHtml(formData.Contact_Mobile)}</p>
            <p>Email: ${escapeHtml(formData.Email_Address)}</p>
            <p>Contact Person: ${escapeHtml(formData.Contact_Person)}</p>
          </div>
          <div class="quotation-title"><span class="underline-text">Quotation for Lab Equipment</span></div>
          <div class="intro">
            <p>Dear Sir/Madam,</p>
            <p>Thank you for your valued enquiry. We take great pleasure in submitting our offer, which we hope will meet your kind approval:</p>
          </div>
          <div>
            <div class="equipment-title"><span class="underline-text">List of Lab Equipment</span></div>
            <table class="equipment-table">
              <thead>
                <tr>${tableHeaders}</tr>
              </thead>
              <tbody>
                ${rowsHtml}
                <tr>
                  <td colspan="${baseColSpan}" style="text-align:right;"><strong>Total</strong></td>
                  <td style="text-align:center;">${totalQty}</td>
                  <td></td> 
                  ${showFields.discount ? "<td></td>" : ""} 
                  <td style="text-align:right;">${totals.subtotal.toFixed(2)}</td>
                  ${footerImageCellHtml}
                </tr>
              </tbody>
            </table>
          </div>
          <div class="terms">
            <h3><span class="underline-text">Terms & Conditions:</span></h3>
            <table class="terms-table">
              ${discountRowHtml}
              <tr><th>Freight</th><td>${freightDisplay}</td></tr>
              <tr><th>Packaging</th><td>${packagingDisplay}</td></tr>
              <tr><th>Tax</th><td>${escapeHtml(formData.Term_Tax || "")}</td></tr>
              <tr><th>Payment</th><td>${escapeHtml(formData.Term_Payment || "")}</td></tr>
              <tr><th>Delivery</th><td>${escapeHtml(formData.Term_Delivery || "")}</td></tr>
              <tr><th>Warranty</th><td>${escapeHtml(formData.Term_Warranty || "").replace(/\n/g, "<br>")}</td></tr>
             
            </table>
          </div>
          <div class="closing">
            <p>Thanking you and awaiting your valued order at your earliest.</p>
            <p>Yours faithfully,</p>
            <p><strong>For Associated Scientific & Engg. Works</strong></p>
          </div>
          <div class="footer">
            <span><strong>Tel:</strong> 9873711119, 9873811119</span>
            <span><strong>Web:</strong> www.asewindia.com</span>
            <span><strong>Email:</strong> sales@asewindia.com</span>
          </div>
        </div>
      </body>
      </html>
    `;

    const element = document.createElement("div");
    element.innerHTML = htmlContent;

    // Use html2pdf to generate a Blob
    const opt = {
      margin: 5,
      filename: "quotation.pdf",
      image: { type: "jpeg", quality: 0.75 },
      html2canvas: { scale: 1.5, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf()
      .set(opt)
      .from(element)
      .output("blob")
      .then((pdfBlob) => {
        resolve(pdfBlob);
      })
      .catch((err) => {
        reject(err);
      });
  });
};
