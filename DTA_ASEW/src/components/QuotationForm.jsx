import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { API_BASE_URL } from "../config";
import {
  FaFileAlt,
  FaInfoCircle,
  FaListUl,
  FaCalculator,
  FaHandshake,
  FaPlus,
  FaTrash,
  FaSave,
  FaPaperPlane,
  FaFilePdf,
  FaCalendarAlt,
  FaHashtag,
  FaUser,
  FaCopy,
  FaSearch,
  FaSpinner,
} from "react-icons/fa";
import {
  fetchCustomers,
  updateCustomerMaster,
} from "../store/slices/customerSlice";
import { fetchItems } from "../store/slices/itemSlice";
import { createSave } from "../store/slices/saveSlice";
import { createResponse } from "../store/slices/responseSlice";
import CustomerModal from "./CustomerModal";
import Select from "react-select";
import toast from "react-hot-toast";
import { useFormik, FormikProvider } from "formik";
import * as Yup from "yup";
import { generateQuotationPDF, generatePDFBlob } from "../utils/pdfGenerator";

const validationSchema = Yup.object().shape({
  Date: Yup.string().required("Date is required"),
  Quotation_No: Yup.string().required("Quotation No is required"),
  Customer_Name: Yup.string().required("Customer Name is required"),
  Email_Address: Yup.string().email("Invalid email"),
  labEquipment: Yup.array()
    .of(
      Yup.object().shape({
        item_name: Yup.string().required("Required"),
        qty: Yup.number().required("Required").min(1, "Min 1"),
        unit_price: Yup.number().required("Required").min(0, "Min 0"),
      }),
    )
    .min(1, "At least one item required"),
});

const compressImage = (file, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error("Canvas to Blob failed"));
            }
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const QuotationForm = () => {
  const dispatch = useDispatch();
  const { customers } = useSelector((state) => state.customer);
  const { items: masterItems } = useSelector((state) => state.item);

  const formik = useFormik({
    initialValues: {
      Date: new Date().toISOString().split("T")[0],
      Quotation_No: "",
      Customer_Name: "",
      Buyer_Address: "",
      Delivery_Address: "",
      GSTIN_UIN: "",
      PAN_No: "",
      Contact_Person: "",
      Email_Address: "",
      Contact_Mobile: "",
      Discount: 0,
      DiscountType: "%",
      Freight_Charges: 0,
      FreightType: "Amount",
      Freight_Note: "",
      Packaging_Charges: 0,
      PackagingType: "Amount",
      Packaging_Note: "",
      Term_Tax: "Extra, GST @ 18%",
      Term_Payment: "30% advance & balance at the time of dispatch",
      Term_Delivery: "1-2 weeks after receipt of your Purchase Order.",
      Term_Warranty:
        "12 months standard warranty against any manufacturing defects or poor workmanship. Warranty shall not be applicable on consumables, rubber, glass and plastic parts, normal wear & tear and mishandling of the equipment.",
      labEquipment: [
        {
          id: 1,
          item_name: "",
          specifications: "",
          qty: 1,
          unit_price: 0,
          total_price: 0,
          image: null,
          hsn: "",
          nabl: "",
          make: "",
          discount_percent: 0,
          gst_percent: 18,
          gst_amount: 0,
        },
      ],
    },
    validationSchema,
    onSubmit: () => {
      // Logic handled by handleSubmit
    },
  });

  const { values, setFieldValue, setValues, errors, touched, setFieldTouched } =
    formik;

  const customerOptions = customers.map((c) => ({
    value: c.Customer_Name || c.CUSTOMER_NAME,
    label: c.Customer_Name || c.CUSTOMER_NAME,
  }));

  const itemOptions = masterItems.map((mi) => ({
    value: mi.ITEM_CODE || mi.ITEM_NAME || "", // Use ITEM_CODE if available
    label: mi.ITEM_NAME ? mi.ITEM_NAME.trim() : "",
    itemName: mi.ITEM_NAME || "",
  }));

  const customSelectStyles = {
    control: (provided, state) => ({
      ...provided,
      borderColor: state.isFocused ? "#2ecc71" : "#e5e7eb",
      boxShadow: state.isFocused ? "0 0 0 1px #2ecc71" : "none",
      "&:hover": {
        borderColor: "#2ecc71",
      },
      borderRadius: "0.375rem",
      fontSize: "0.875rem",
      minHeight: "38px",
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected
        ? "#2ecc71"
        : state.isFocused
          ? "#f1f8f5"
          : "white",
      color: state.isSelected ? "white" : "#374151",
      "&:active": {
        backgroundColor: "#2ecc71",
        color: "white",
      },
      cursor: "pointer",
    }),
  };

  const [isSearching, setIsSearching] = useState(false);

  // Helper to populate form from a found quotation record
  const populateFormFromRecord = (found) => {
    const header = found.header || found;
    const items = found.items || [];

    setValues((prev) => ({
      ...prev,
      Customer_Name: header.Customer_Name || "",
      Buyer_Address: header.Buyer_Address || "",
      Delivery_Address: header.Delivery_Address || "",
      GSTIN_UIN: header.GSTIN_UIN || "",
      Contact_Person: header.Contact_Person || "",
      Email_Address: header.Email_Address || "",
      Contact_Mobile: header.Contact_Mobile || "",
      Discount: header.Discount || 0,
      DiscountType: header.Discount_Type || header.DiscountType || "%",
      Freight_Charges: header.Freight_Charges || 0,
      FreightType: header.Freight_Type || header.FreightType || "Amount",
      Freight_Note: header.Freight_Note || "",
      Packaging_Charges: header.Packaging_Charges || 0,
      PackagingType: header.Packaging_Type || header.PackagingType || "Amount",
      Packaging_Note: header.Packaging_Note || "",
      Term_Tax: header.Term_Tax || prev.Term_Tax,
      Term_Payment: header.Term_Payment || prev.Term_Payment,
      Term_Delivery: header.Term_Delivery || prev.Term_Delivery,
      Term_Warranty: header.Term_Warranty || prev.Term_Warranty,
      labEquipment: items.map((item, idx) => ({
        id: Date.now() + idx,
        item_name: (
          item.item_name ||
          item.Item_Name ||
          item.ITEM_NAME ||
          ""
        ).trim(),
        specifications: item.specifications || item.SPECIFICATIONS || "",
        qty: Number(item.qty || item.Qty || item.QTY || 1),
        unit_price: Number(
          item.unit_price || item.Unit_Price || item.unitPrice || 0,
        ),
        total_price: Number(item.total_price || item.Total_Price || 0),
        hsn: item.hsn || item.HSN_Code || item.HSN_CODE || "",
        make: item.make || item.Make || item.MAKE || "",
        nabl: item.nabl || item.NABL || "No",
        discount_percent: Number(
          item.discount_percent ||
            item.Item_Discount ||
            item.Discount_Percent ||
            0,
        ),
        gst_percent: Number(item.gst_percent || item.GST_Percent || 18),
        gst_amount: Number(item.gst_amount || item.GST_Amount || 0),
        image: null,
      })),
    }));

    const hasHSN = items.some((i) => i.hsn || i.HSN_Code || i.HSN_CODE);
    const hasNABL = items.some(
      (i) => (i.nabl || i.NABL) && (i.nabl || i.NABL) !== "No",
    );
    const hasMake = items.some((i) => i.make || i.Make || i.MAKE);
    const hasDiscount = items.some(
      (i) =>
        Number(i.discount_percent || i.Item_Discount || i.Discount_Percent) > 0,
    );
    setShowFields({
      hsn: !!hasHSN,
      nabl: !!hasNABL,
      make: !!hasMake,
      discount: !!hasDiscount,
      gst: true,
    });
  };

  const handleSearchQuotation = async () => {
    const searchNo = values.Quotation_No.trim();
    if (!searchNo) {
      toast.error("Please enter a quotation number to search");
      return;
    }

    setIsSearching(true);

    try {
      // 1. Try the saves (drafts) endpoint first
      try {
        const saveRes = await axios.get(
          `${API_BASE_URL}/api/save?quotationNo=${encodeURIComponent(searchNo)}`,
        );
        const record = saveRes.data?.data?.[0];
        if (record) {
          populateFormFromRecord(record);
          toast.success("Quotation found and loaded!");
          return;
        }
      } catch (saveErr) {
        // 404 means not in saves — continue to responses
        if (saveErr.response?.status !== 404) throw saveErr;
      }

      // 2. Try the responses (submitted) endpoint
      try {
        const respRes = await axios.get(
          `${API_BASE_URL}/api/response?quotationNo=${encodeURIComponent(searchNo)}`,
        );
        const record = respRes.data?.data?.[0];
        if (record) {
          populateFormFromRecord(record);
          toast.success("Quotation found and loaded!");
          return;
        }
      } catch (respErr) {
        if (respErr.response?.status !== 404) throw respErr;
      }

      // Not found in either
      toast.error(`Quotation "${searchNo}" not found`);
    } catch (err) {
      console.error("[Search] Unexpected error:", err);
      toast.error("Error searching quotation. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const [showFields, setShowFields] = useState({
    hsn: false,
    nabl: false,
    make: false,
    discount: false,
    gst: true,
  });

  useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchItems());
  }, [dispatch]);

  const fetchNextQuotationNo = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/quotation/next-number`);
      if (res.data?.success && res.data.nextQuotationNo) {
        setFieldValue("Quotation_No", res.data.nextQuotationNo);
      }
    } catch (err) {
      console.error("Failed to fetch next quotation number:", err);
    }
  };

  useEffect(() => {
    if (!values.Quotation_No) {
      fetchNextQuotationNo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFieldValue(name, value);

    if (name === "Customer_Name") {
      const selectedCustomer = customers.find(
        (c) => (c.Customer_Name || c.CUSTOMER_NAME) === value,
      );
      if (selectedCustomer) {
        setValues((prev) => ({
          ...prev,
          Customer_Name: value,
          Buyer_Address:
            selectedCustomer.Buyer_Address ||
            selectedCustomer.BUYER_ADDRESS ||
            "",
          Delivery_Address:
            selectedCustomer.Delivery_Address ||
            selectedCustomer.DELIVERY_ADDRESS ||
            "",
          GSTIN_UIN:
            selectedCustomer.GSTIN_UIN || selectedCustomer.GSTIN_UIN || "",
          PAN_No: selectedCustomer.PAN_No || selectedCustomer.PAN_NO || "",
          Contact_Person:
            selectedCustomer.Contact_Person ||
            selectedCustomer.CONTACT_PERSON ||
            "",
          Email_Address:
            selectedCustomer.Email_Address ||
            selectedCustomer.EMAIL_ADDRESS ||
            "",
          Contact_Mobile:
            selectedCustomer.Contact_Mobile ||
            selectedCustomer.CONTACT_MOBILE ||
            "",
        }));
      }
    }
  };

  const handleEquipmentChange = (index, field, value) => {
    const updated = [...values.labEquipment];
    updated[index][field] = value;

    if (field === "item_name") {
      const selectedItem = masterItems.find(
        (item) =>
          item.ITEM_CODE === value || item.ITEM_NAME?.trim() === value?.trim(),
      );
      if (selectedItem) {
        updated[index].item_name = selectedItem.ITEM_NAME || value;
        updated[index].specifications = selectedItem.SPECIFICATIONS || "";
        const priceStr = selectedItem.UNIT_PRICE || "0";
        updated[index].unit_price = parseFloat(priceStr.replace(/,/g, "")) || 0;
        updated[index].hsn = selectedItem.HSN_CODE || "";
        updated[index].make = selectedItem.MAKE || "";
        updated[index].nabl = selectedItem.NABL ? "Yes" : "";
      }
    }

    if (
      field === "qty" ||
      field === "unit_price" ||
      field === "discount_percent" ||
      field === "gst_percent" ||
      field === "item_name"
    ) {
      const qty = Number(updated[index].qty) || 0;
      const price = Number(updated[index].unit_price) || 0;
      const disc = Number(updated[index].discount_percent) || 0;
      const gstP = Number(updated[index].gst_percent) || 0;

      const taxable = qty * price * (1 - disc / 100);
      const gstAmt = taxable * (gstP / 100);

      updated[index].gst_amount = gstAmt;
      updated[index].total_price = taxable + gstAmt;
    }
    setFieldValue("labEquipment", updated);
  };

  const addMoreEquipment = () => {
    setFieldValue("labEquipment", [
      ...values.labEquipment,
      {
        id: Date.now(),
        item_name: "",
        specifications: "",
        qty: 1,
        unit_price: 0,
        total_price: 0,
        image: null,
        hsn: "",
        nabl: "",
        make: "",
        discount_percent: 0,
        gst_percent: 18,
        gst_amount: 0,
      },
    ]);
  };

  const removeEquipment = (index) => {
    if (values.labEquipment.length > 1) {
      setFieldValue(
        "labEquipment",
        values.labEquipment.filter((_, i) => i !== index),
      );
    }
  };

  const calculateSubtotal = () => {
    return values.labEquipment.reduce((sum, item) => {
      const taxable = (item.qty || 0) * (item.unit_price || 0) * (1 - (item.discount_percent || 0) / 100);
      return sum + taxable;
    }, 0);
  };

  const calculateTotalGST = () => {
    return values.labEquipment.reduce((sum, item) => sum + (item.gst_amount || 0), 0);
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    const totalGST = calculateTotalGST();
    let total = subtotal + totalGST;

    // Discount
    if (values.DiscountType === "%") {
      total -= subtotal * (values.Discount / 100);
    } else {
      total -= Number(values.Discount);
    }

    // Freight
    if (values.FreightType === "%") {
      total += subtotal * (Number(values.Freight_Charges) / 100);
    } else {
      total += Number(values.Freight_Charges);
    }

    // Packaging
    if (values.PackagingType === "%") {
      total += subtotal * (Number(values.Packaging_Charges) / 100);
    } else {
      total += Number(values.Packaging_Charges);
    }

    return total;
  };

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  // Copy Old Quotation modal state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copyQuotationNo, setCopyQuotationNo] = useState("");
  const [copyLoading, setCopyLoading] = useState(false);

  const handleCopyOld = async () => {
    const searchNo = copyQuotationNo.trim();
    if (!searchNo) {
      toast.error("Please enter a quotation number");
      return;
    }

    setCopyLoading(true);

    try {
      // Fetch directly from backend instead of searching in large Redux state
      const respRes = await axios.get(
        `${API_BASE_URL}/api/response?quotationNo=${encodeURIComponent(searchNo)}`,
      );
      const found = respRes.data?.data?.[0];

      if (found) {
        const header = found.header || found;
        const items = found.items || [];

        setValues((prev) => ({
          ...prev,
          Customer_Name: header.Customer_Name || "",
          Buyer_Address: header.Buyer_Address || "",
          Delivery_Address: header.Delivery_Address || "",
          GSTIN_UIN: header.GSTIN_UIN || "",
          PAN_No: header.PAN_No || "",
          Contact_Person: header.Contact_Person || "",
          Email_Address: header.Email_Address || "",
          Contact_Mobile: header.Contact_Mobile || "",
          Discount: header.Discount || 0,
          DiscountType: header.DiscountType || "%",
          Freight_Charges: header.Freight_Charges || 0,
          FreightType: header.FreightType || "Amount",
          Freight_Note: header.Freight_Note || "",
          Packaging_Charges: header.Packaging_Charges || 0,
          PackagingType: header.PackagingType || "Amount",
          Packaging_Note: header.Packaging_Note || "",
          Term_Tax: header.Term_Tax || prev.Term_Tax,
          Term_Payment: header.Term_Payment || prev.Term_Payment,
          Term_Delivery: header.Term_Delivery || prev.Term_Delivery,
          Term_Warranty: header.Term_Warranty || prev.Term_Warranty,
          labEquipment: items.map((item, idx) => ({
            id: Date.now() + idx,
            item_name: (
              item.item_name ||
              item.Item_Name ||
              item.ITEM_NAME ||
              ""
            ).trim(),
            specifications: item.specifications || item.SPECIFICATIONS || "",
            qty: Number(item.qty || item.Qty || item.QTY || 1),
            unit_price: Number(item.unit_price || item.Unit_Price || 0),
            total_price: Number(item.total_price || item.Total_Price || 0),
            hsn: item.hsn || item.HSN_Code || item.HSN_CODE || "",
            make: item.make || item.Make || item.MAKE || "",
            nabl: item.nabl || item.NABL || "",
            discount_percent: Number(
              item.discount_percent ||
                item.Item_Discount ||
                item.Discount_Percent ||
                0,
            ),
            gst_percent: Number(item.gst_percent || item.GST_Percent || 18),
            gst_amount: Number(item.gst_amount || item.GST_Amount || 0),
            image: null,
          })),
        }));

        const hasHSN = items.some((i) => i.hsn || i.HSN_Code || i.HSN_CODE);
        const hasNABL = items.some((i) => i.nabl || i.NABL);
        const hasMake = items.some((i) => i.make || i.Make || i.MAKE);
        const hasDiscount = items.some(
          (i) =>
            i.discount_percent ||
            i.Item_Discount ||
            i.Discount_Percent ||
            i.discount,
        );

        setShowFields({
          hsn: !!hasHSN,
          nabl: !!hasNABL,
          make: !!hasMake,
          discount: !!hasDiscount,
          gst: true,
        });

        toast.success(`Quotation "${searchNo}" copied successfully!`);
        setShowCopyModal(false);
        setCopyQuotationNo("");
      } else {
        toast.error(`Quotation "${searchNo}" not found in responses`);
      }
    } catch (err) {
      console.error("[CopyOld] Error:", err);
      toast.error("Error fetching quotation details");
    } finally {
      setCopyLoading(false);
    }
  };

  const handleSubmit = async (actionType) => {
    // Basic validations
    if (!values.Date) {
      toast.error("Date is required.");
      return;
    }

    if (!values.Customer_Name?.trim()) {
      toast.error("Please select a Customer before submitting.");
      return;
    }

    const validItems = values.labEquipment.filter(
      (item) => item.item_name && item.item_name.trim() !== "",
    );

    if (validItems.length === 0) {
      toast.error("Please select at least one item for the quotation.");
      return;
    }

    const loadingToastId = toast.loading("Processing quotation...");
    const data = new FormData();

    try {
      // 1. Compress all images first to reduce payload size
      const compressedImages = await Promise.all(
        validItems.map(async (item) => {
          if (item.image instanceof File || item.image instanceof Blob) {
            try {
              const compressed = await compressImage(item.image);
              return compressed;
            } catch (err) {
              console.error("Image compression failed, using original:", err);
              return item.image;
            }
          }
          return item.image;
        }),
      );

      // 2. Populate FormData
      Object.keys(values).forEach((key) => {
        if (key !== "labEquipment") {
          data.append(key, values[key]);
        }
      });

      const itemsForJSON = validItems.map((item, idx) => ({
        ...item,
        image: !!compressedImages[idx], // Convert to boolean flag for serialization
      }));
      data.append("ITEMS", JSON.stringify(itemsForJSON));
      data.append("Subtotal", calculateSubtotal());
      data.append("Total_GST", calculateTotalGST());
      data.append("Total_Amount", calculateGrandTotal());

      // Append COMPRESSED images only for valid items
      compressedImages.forEach((img) => {
        if (img) {
          data.append("Image_URL", img);
        }
      });

      // Send the column visibility settings to the backend
      data.append("showFields", JSON.stringify(showFields));

      // 3. Generate PDF
      const totals = {
        subtotal: calculateSubtotal(),
        totalGST: calculateTotalGST(),
        grandTotal: calculateGrandTotal(),
      };
      const pdfBlob = await generatePDFBlob(
        values,
        validItems,
        showFields,
        totals,
      );
      const sanitizedQuotationNo = (values.Quotation_No || "New").replace(
        /\//g,
        "_",
      );
      const sanitizedCustomerName = (
        values.Customer_Name || "Customer"
      ).replace(/[^a-zA-Z0-9]/g, "_");
      const pdfFilename = `${sanitizedCustomerName}__${sanitizedQuotationNo}.pdf`;

      // Append PDF File for the API to upload to Drive
      data.append("Generated_PDF", pdfBlob, pdfFilename);

      // Automatically sync customer details to Customer Master
      if (values.Customer_Name) {
        const customerData = {
          Customer_Name: values.Customer_Name,
          Buyer_Address: values.Buyer_Address,
          GSTIN_UIN: values.GSTIN_UIN,
          PAN_No: values.PAN_No,
          Contact_Person: values.Contact_Person,
          Email_Address: values.Email_Address,
          Contact_Mobile: values.Contact_Mobile,
          Delivery_Address: values.Delivery_Address,
        };
        dispatch(
          updateCustomerMaster({
            customerData,
          }),
        )
          .unwrap()
          .catch((err) =>
            console.error(`[AutoSync] Customer update failed:`, err),
          );
      }
    } catch (err) {
      console.error("Processing failed:", err);
      toast.error(
        "Failed to process quotation details. Proceeding without some optimizations.",
        {
          id: loadingToastId,
        },
      );
    }

    if (actionType === "save") {
      dispatch(createSave(data))
        .unwrap()
        .then(() => {
          toast.success("Quotation saved successfully!", {
            id: loadingToastId,
          });
          setTimeout(() => window.location.reload(), 1500);
        })
        .catch((error) => {
          toast.error(error || "Failed to save quotation", {
            id: loadingToastId,
          });
        });
    } else if (actionType === "submit") {
      dispatch(createResponse(data))
        .unwrap()
        .then(() => {
          toast.success("Quotation response submitted successfully!", {
            id: loadingToastId,
          });
          setTimeout(() => window.location.reload(), 1500);
        })
        .catch((error) => {
          toast.error(error || "Failed to submit quotation response", {
            id: loadingToastId,
          });
        });
    }
  };

  const inputClass =
    "p-2.5 px-4 border border-gray-200 rounded-md text-sm sm:text-base bg-white transition-colors focus:outline-none focus:border-[#2ecc71] w-full";
  const labelClass =
    "flex items-center gap-2.5 font-semibold text-gray-700 whitespace-nowrap text-sm sm:text-base";
  const rowGroupClass =
    "flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:items-center gap-2 sm:gap-4";
  const btnBaseClass =
    "px-4 sm:px-5 py-2 sm:py-2.5 rounded-md font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all text-xs sm:text-sm hover:opacity-90 hover:-translate-y-0.5 shadow-sm";

  return (
    <FormikProvider value={formik}>
      <div className="max-w-[1200px] mx-auto my-5 px-5 font-sans text-gray-800 relative">
        {/* Global Loader Overlay */}
        {isSearching && (
          <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-white/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-[#2ecc71]/20 border-t-[#2ecc71] rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <FaSearch className="text-[#2ecc71] text-2xl animate-pulse" />
              </div>
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <h3 className="text-xl font-bold text-gray-800 tracking-tight">
                Fetching Data
              </h3>
              <p className="text-gray-500 text-sm animate-pulse">
                Please wait while we retrieve your quotation...
              </p>
            </div>
          </div>
        )}

        <CustomerModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onCustomerCreated={(newCust) => {
            if (newCust) {
              setValues((prev) => ({
                ...prev,
                Customer_Name: newCust.Customer_Name,
                Buyer_Address: newCust.Buyer_Address || "",
                Delivery_Address: newCust.Delivery_Address || "",
                GSTIN_UIN: newCust.GSTIN_UIN || "",
                PAN_No: newCust.PAN_No || "",
                Contact_Person: newCust.Contact_Person || "",
                Email_Address: newCust.Email_Address || "",
                Contact_Mobile: newCust.Contact_Mobile || "",
              }));
              toast.success(`Form filled for ${newCust.Customer_Name}`);
            }
            setIsCustomerModalOpen(false);
          }}
        />

        {/* Copy Old Quotation Modal */}
        {showCopyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              {/* Modal Header */}
              <div className="bg-[#f39c12] px-6 py-4 flex items-center gap-3">
                <FaCopy className="text-white text-xl" />
                <h2 className="text-white text-lg font-bold tracking-wide">
                  Copy Old Quotation
                </h2>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-6 flex flex-col gap-4">
                <p className="text-gray-600 text-sm leading-relaxed">
                  Enter the{" "}
                  <span className="font-semibold text-gray-800">
                    OLD Quotation Number
                  </span>{" "}
                  you want to copy:
                  <span className="block mt-1 text-xs text-gray-400 font-mono">
                    e.g., 2026-27/QT/0111
                  </span>
                </p>

                <input
                  type="text"
                  value={copyQuotationNo}
                  onChange={(e) => setCopyQuotationNo(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCopyOld()}
                  placeholder="2026-27/QT/0111"
                  autoFocus
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-[#f39c12] transition-colors placeholder-gray-300"
                />
              </div>

              {/* Modal Footer */}
              <div className="px-6 pb-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCopyModal(false);
                    setCopyQuotationNo("");
                  }}
                  disabled={copyLoading}
                  className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCopyOld}
                  disabled={copyLoading}
                  className="px-5 py-2.5 rounded-lg bg-[#f39c12] text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60 shadow-md"
                >
                  {copyLoading ? (
                    <>
                      <FaSpinner className="animate-spin" /> Searching...
                    </>
                  ) : (
                    <>
                      <FaCopy /> Copy Quotation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quotation Details Card */}
        <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.05)] p-8 mb-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-10 pb-5 border-b border-gray-100 text-center sm:text-left">
            <FaFileAlt size={30} className="text-gray-700 sm:size-[35px]" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl tracking-tight text-gray-800 uppercase font-bold">
              ASEW QUOTATION FORM
            </h1>
          </div>

          <div className="flex items-center justify-center gap-2.5 text-[#2ecc71] text-xl sm:text-2xl font-semibold mb-6 sm:mb-8">
            <FaInfoCircle /> Quotation Details
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 sm:gap-y-6">
            <div className={`${rowGroupClass} md:col-span-2`}>
              <label className={labelClass}>
                <FaCalendarAlt className="text-gray-500" /> Date
              </label>
              <input
                type="date"
                name="Date"
                value={values.Date}
                onChange={handleInputChange}
                onBlur={() => setFieldTouched("Date")}
                className={`${inputClass} ${touched.Date && errors.Date ? "border-red-500 text-red-600" : ""}`}
              />
              {touched.Date && errors.Date && (
                <div className="text-red-500 text-[10px] mt-1">
                  {errors.Date}
                </div>
              )}
            </div>

            <div className={`${rowGroupClass} md:col-span-2`}>
              <label className={labelClass}>
                <FaHashtag className="text-gray-500" /> Quotation No.
              </label>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <div className="flex-1 flex flex-col relative">
                  <input
                    type="text"
                    name="Quotation_No"
                    value={values.Quotation_No}
                    onChange={handleInputChange}
                    onBlur={() => setFieldTouched("Quotation_No")}
                    placeholder="Enter manually"
                    className={`${inputClass} ${touched.Quotation_No && errors.Quotation_No ? "border-red-500 text-red-600" : ""}`}
                  />
                  {!values.Quotation_No && (
                    <div className="absolute right-3 top-[10px] text-[#3498db]">
                      <FaSpinner className="animate-spin text-lg" />
                    </div>
                  )}
                  {touched.Quotation_No && errors.Quotation_No && (
                    <div className="text-red-500 text-[10px] mt-1">
                      {errors.Quotation_No}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCopyQuotationNo("");
                      setShowCopyModal(true);
                    }}
                    className={`${btnBaseClass} bg-[#f39c12] text-white flex-1 sm:px-4 whitespace-nowrap h-[38px] sm:h-[42px]`}
                  >
                    <FaCopy /> Copy Old
                  </button>
                  {values.Quotation_No.trim() && (
                    <button
                      type="button"
                      onClick={handleSearchQuotation}
                      disabled={isSearching}
                      className={`${btnBaseClass} border border-[#3498db] text-[#3498db] bg-transparent flex-1 sm:px-4 whitespace-nowrap h-[38px] sm:h-[42px] disabled:opacity-50`}
                    >
                      {isSearching ? (
                        <>
                          <FaSpinner className="animate-spin" /> Searching...
                        </>
                      ) : (
                        <>
                          <FaSearch /> Search Old
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:grid sm:grid-cols-[140px_1fr] sm:items-center gap-2 sm:gap-4 md:col-span-2">
              <label className={labelClass}>
                <FaUser className="text-gray-500" /> Customer
              </label>
              <div className="flex flex-col sm:flex-row gap-2 flex-1 sm:items-center">
                <div className="flex-1 flex flex-col">
                  <Select
                    options={customerOptions}
                    value={customerOptions.find(
                      (opt) => opt.value === values.Customer_Name,
                    )}
                    onChange={(selected) =>
                      handleInputChange({
                        target: {
                          name: "Customer_Name",
                          value: selected ? selected.value : "",
                        },
                      })
                    }
                    onBlur={() => setFieldTouched("Customer_Name")}
                    styles={customSelectStyles}
                    placeholder="Select Customer"
                    isClearable
                    menuPortalTarget={document.body}
                  />
                  {touched.Customer_Name && errors.Customer_Name && (
                    <div className="text-red-500 text-[10px] mt-1">
                      {errors.Customer_Name}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className={`${btnBaseClass} border border-[#3498db] text-[#3498db] bg-transparent whitespace-nowrap h-[38px] w-full sm:w-auto`}
                >
                  <FaPlus /> Add New
                </button>
              </div>
            </div>

            <div className={rowGroupClass}>
              <label className={labelClass}>Buyer Address</label>
              <textarea
                name="Buyer_Address"
                value={values.Buyer_Address}
                onChange={handleInputChange}
                placeholder="Full address of buyer"
                className={`${inputClass} min-h-[80px]`}
              ></textarea>
            </div>

            <div className={rowGroupClass}>
              <label className={labelClass}>Delivery Address</label>
              <textarea
                name="Delivery_Address"
                value={values.Delivery_Address}
                onChange={handleInputChange}
                placeholder="Full delivery address"
                className={`${inputClass} min-h-[80px]`}
              ></textarea>
            </div>

            <div className={rowGroupClass}>
              <label className={labelClass}>GSTIN/UIN</label>
              <input
                type="text"
                name="GSTIN_UIN"
                value={values.GSTIN_UIN}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>

            <div className={rowGroupClass}>
              <label className={labelClass}>Contact Person</label>
              <input
                type="text"
                name="Contact_Person"
                value={values.Contact_Person}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>

            <div className={rowGroupClass}>
              <label className={labelClass}>Email Address</label>
              <div className="flex flex-col">
                <input
                  type="email"
                  name="Email_Address"
                  value={values.Email_Address}
                  onChange={handleInputChange}
                  onBlur={() => setFieldTouched("Email_Address")}
                  className={`${inputClass} ${touched.Email_Address && errors.Email_Address ? "border-red-500 text-red-600" : ""}`}
                />
                {touched.Email_Address && errors.Email_Address && (
                  <div className="text-red-500 text-[10px] mt-1">
                    {errors.Email_Address}
                  </div>
                )}
              </div>
            </div>

            <div className={rowGroupClass}>
              <label className={labelClass}>Contact Mobile</label>
              <input
                type="text"
                name="Contact_Mobile"
                value={values.Contact_Mobile}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Lab Equipment Section */}
        <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.05)] p-8 mb-8">
          <div className="flex items-center justify-center gap-2.5 text-[#2ecc71] text-2xl font-semibold mb-8">
            <FaListUl /> List of Lab Equipment
          </div>

          <div className="flex flex-wrap justify-start sm:justify-end gap-3 sm:gap-6 mb-6">
            {["hsn", "nabl", "make", "discount", "gst"].map((field) => (
              <label
                key={field}
                className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 cursor-pointer bg-gray-50 px-2 py-1 rounded-md border border-gray-100 sm:bg-transparent sm:p-0 sm:border-0"
              >
                <input
                  type="checkbox"
                  checked={showFields[field]}
                  onChange={(e) =>
                    setShowFields((prev) => ({
                      ...prev,
                      [field]: e.target.checked,
                    }))
                  }
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                />
                {field.toUpperCase()}
              </label>
            ))}
          </div>

          <div className="w-full overflow-x-auto rounded-lg border border-gray-200 mb-5">
            <table className="w-full border-collapse table-fixed min-w-[1000px]">
              <thead>
                <tr className="bg-[#6c5ce7] text-white">
                  <th className="w-[60px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                    Sr. No.
                  </th>
                  <th className="w-[250px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                    Item
                  </th>
                  {showFields.hsn && (
                    <th className="w-[120px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                      HSN/SAC
                    </th>
                  )}
                  {showFields.nabl && (
                    <th className="w-[100px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                      NABL
                    </th>
                  )}
                  {showFields.make && (
                    <th className="w-[120px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                      Make
                    </th>
                  )}
                  <th className="w-[250px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                    Specifications
                  </th>
                  <th className="w-[80px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                    Qty.
                  </th>
                  <th className="w-[120px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                    Unit Price
                  </th>
                  {showFields.discount && (
                    <th className="w-[100px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                      Disc. %
                    </th>
                  )}
                  {showFields.gst && (
                    <>
                      <th className="w-[80px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                        GST %
                      </th>
                      <th className="w-[100px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                        GST Amt
                      </th>
                    </>
                  )}
                  <th className="w-[140px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                    Total Price
                  </th>
                  <th className="w-[200px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                    Image
                  </th>
                  <th className="w-[80px] p-3.5 border border-white/10 font-semibold text-[0.85rem]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {values.labEquipment.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-2 border border-gray-200 text-center">
                      {index + 1}
                    </td>
                    <td
                      className="p-2 border border-gray-200"
                      title={item.item_name}
                    >
                      <div className="flex flex-col">
                        <Select
                          options={itemOptions}
                          value={itemOptions.find(
                            (opt) =>
                              opt.value === item.item_name ||
                              opt.itemName === item.item_name,
                          )}
                          onChange={(selected) =>
                            handleEquipmentChange(
                              index,
                              "item_name",
                              selected ? selected.value : "",
                            )
                          }
                          onBlur={() =>
                            setFieldTouched(`labEquipment[${index}].item_name`)
                          }
                          styles={customSelectStyles}
                          placeholder="Select Item"
                          isClearable
                          menuPortalTarget={document.body}
                          formatOptionLabel={(option) => (
                            <span title={option.label}>{option.label}</span>
                          )}
                          className={`${touched.labEquipment?.[index]?.item_name && errors.labEquipment?.[index]?.item_name ? "border-red-500 rounded" : ""}`}
                        />
                        {touched.labEquipment?.[index]?.item_name &&
                          errors.labEquipment?.[index]?.item_name && (
                            <div className="text-red-500 text-[9px] mt-0.5">
                              {errors.labEquipment[index].item_name}
                            </div>
                          )}
                      </div>
                    </td>
                    {showFields.hsn && (
                      <td className="p-2 border border-gray-200">
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) =>
                            handleEquipmentChange(index, "hsn", e.target.value)
                          }
                          className="w-full p-2 border border-gray-200 rounded text-sm"
                        />
                      </td>
                    )}
                    {showFields.nabl && (
                      <td className="p-2 border border-gray-200">
                        <input
                          type="text"
                          value={item.nabl}
                          onChange={(e) =>
                            handleEquipmentChange(index, "nabl", e.target.value)
                          }
                          className="w-full p-2 border border-gray-200 rounded text-sm"
                        />
                      </td>
                    )}
                    {showFields.make && (
                      <td className="p-2 border border-gray-200">
                        <input
                          type="text"
                          value={item.make}
                          onChange={(e) =>
                            handleEquipmentChange(index, "make", e.target.value)
                          }
                          className="w-full p-2 border border-gray-200 rounded text-sm"
                        />
                      </td>
                    )}
                    <td className="p-2 border border-gray-200">
                      <input
                        type="text"
                        value={item.specifications}
                        title={item.specifications}
                        onChange={(e) =>
                          handleEquipmentChange(
                            index,
                            "specifications",
                            e.target.value,
                          )
                        }
                        className="w-full p-2 border border-gray-200 rounded text-sm"
                      />
                    </td>
                    <td className="p-2 border border-gray-200 text-center">
                      <div className="flex flex-col">
                        <input
                          type="number"
                          value={item.qty}
                          min="1"
                          onChange={(e) =>
                            handleEquipmentChange(
                              index,
                              "qty",
                              Number(e.target.value),
                            )
                          }
                          onBlur={() =>
                            setFieldTouched(`labEquipment[${index}].qty`)
                          }
                          className={`w-full p-2 border rounded text-sm text-center ${touched.labEquipment?.[index]?.qty && errors.labEquipment?.[index]?.qty ? "border-red-500" : "border-gray-200"}`}
                        />
                        {touched.labEquipment?.[index]?.qty &&
                          errors.labEquipment?.[index]?.qty && (
                            <div className="text-red-500 text-[9px] mt-0.5">
                              {errors.labEquipment[index].qty}
                            </div>
                          )}
                      </div>
                    </td>
                    <td className="p-2 border border-gray-200">
                      <div className="flex flex-col">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleEquipmentChange(
                              index,
                              "unit_price",
                              Number(e.target.value),
                            )
                          }
                          onBlur={() =>
                            setFieldTouched(`labEquipment[${index}].unit_price`)
                          }
                          className={`w-full p-2 border rounded text-sm text-right ${touched.labEquipment?.[index]?.unit_price && errors.labEquipment?.[index]?.unit_price ? "border-red-500" : "border-gray-200"}`}
                        />
                        {touched.labEquipment?.[index]?.unit_price &&
                          errors.labEquipment?.[index]?.unit_price && (
                            <div className="text-red-500 text-[9px] mt-0.5">
                              {errors.labEquipment[index].unit_price}
                            </div>
                          )}
                      </div>
                    </td>
                    {showFields.discount && (
                      <td className="p-2 border border-gray-200">
                        <input
                          type="number"
                          value={item.discount_percent}
                          onChange={(e) =>
                            handleEquipmentChange(
                              index,
                              "discount_percent",
                              Number(e.target.value),
                            )
                          }
                          className="w-full p-2 border border-gray-200 rounded text-sm text-center"
                        />
                      </td>
                    )}
                    {showFields.gst && (
                      <>
                        <td className="p-2 border border-gray-200">
                          <input
                            type="number"
                            value={item.gst_percent}
                            onChange={(e) =>
                              handleEquipmentChange(
                                index,
                                "gst_percent",
                                Number(e.target.value),
                              )
                            }
                            className="w-full p-2 border border-gray-200 rounded text-sm text-center"
                          />
                        </td>
                        <td className="p-2 border border-gray-200">
                          <input
                            type="number"
                            value={item.gst_amount.toFixed(2)}
                            readOnly
                            className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm text-right font-semibold"
                          />
                        </td>
                      </>
                    )}
                    <td className="p-2 border border-gray-200">
                      <input
                        type="number"
                        value={item.total_price}
                        readOnly
                        className="w-full p-2 bg-gray-50 border border-gray-200 rounded text-sm text-right font-semibold"
                      />
                    </td>
                    <td className="p-2 border border-gray-200">
                      <input
                        type="file"
                        onChange={(e) =>
                          handleEquipmentChange(
                            index,
                            "image",
                            e.target.files[0],
                          )
                        }
                        className="text-xs"
                      />
                    </td>
                    <td className="p-2 border border-gray-200 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => removeEquipment(index)}
                          title="Delete Row"
                          className="bg-red-500 text-white p-2 rounded hover:bg-red-600 transition-colors"
                        >
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#f1f8f5] font-bold">
                  <td
                    colSpan={
                      2 +
                      (showFields.hsn ? 1 : 0) +
                      (showFields.nabl ? 1 : 0) +
                      (showFields.make ? 1 : 0) +
                      1
                    }
                    className="p-3 text-right pr-4"
                  >
                    <FaCalculator className="inline mr-2" /> Total
                  </td>
                  <td className="text-center">
                    {values.labEquipment.reduce(
                      (sum, item) => sum + item.qty,
                      0,
                    )}
                  </td>
                  <td className="text-center">-</td>
                  {showFields.discount && <td className="text-center">-</td>}
                  {showFields.gst && (
                    <>
                      <td className="text-center">-</td>
                      <td className="text-right pr-2 text-[#2ecc71]">
                        {calculateTotalGST().toFixed(2)}
                      </td>
                    </>
                  )}
                  <td className="text-center text-[#2ecc71]">
                    {calculateGrandTotal().toFixed(2)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            onClick={addMoreEquipment}
            className={`${btnBaseClass} bg-[#2ecc71] text-white`}
          >
            <FaPlus /> Add More
          </button>
        </div>

        {/* Additional Charges Card */}
        <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.05)] p-8 mb-8">
          <div className="flex items-center justify-center gap-2.5 text-[#2ecc71] text-2xl font-semibold mb-8">
            <FaCalculator /> Additional Charges
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="flex flex-col gap-3">
              <div className="font-semibold text-gray-700 text-sm sm:text-base">
                % Discount
              </div>
              <div className="flex border border-gray-200 rounded-md overflow-hidden h-[42px]">
                <input
                  type="number"
                  name="Discount"
                  value={values.Discount}
                  onChange={handleInputChange}
                  className="flex-1 p-2 focus:outline-none px-4 text-sm sm:text-base"
                />
                <select
                  name="DiscountType"
                  value={values.DiscountType}
                  onChange={handleInputChange}
                  className="border-l border-gray-200 bg-gray-50 p-2 focus:outline-none text-xs sm:text-sm"
                >
                  <option value="%">%</option>
                  <option value="Amount">Amount</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 font-semibold text-gray-700 text-sm sm:text-base">
                <FaPaperPlane className="text-gray-500" /> Freight Charges
              </div>
              <div className="flex border border-gray-200 rounded-md overflow-hidden h-[42px]">
                <input
                  type="number"
                  name="Freight_Charges"
                  value={values.Freight_Charges}
                  onChange={handleInputChange}
                  className="flex-1 p-2 focus:outline-none px-4 text-sm sm:text-base"
                />
                <select
                  name="FreightType"
                  value={values.FreightType}
                  onChange={handleInputChange}
                  className="border-l border-gray-200 bg-gray-50 p-2 focus:outline-none text-xs sm:text-sm"
                >
                  <option value="Amount">Amount</option>
                  <option value="%">%</option>
                </select>
              </div>
              <input
                type="text"
                name="Freight_Note"
                placeholder="Note (e.g. To Pay)"
                value={values.Freight_Note}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="font-semibold text-gray-700 text-sm sm:text-base">
                Packaging Charges
              </div>
              <div className="flex border border-gray-200 rounded-md overflow-hidden h-[42px]">
                <input
                  type="number"
                  name="Packaging_Charges"
                  value={values.Packaging_Charges}
                  onChange={handleInputChange}
                  className="flex-1 p-2 focus:outline-none px-4 text-sm sm:text-base"
                />
                <select
                  name="PackagingType"
                  value={values.PackagingType}
                  onChange={handleInputChange}
                  className="border-l border-gray-200 bg-gray-50 p-2 focus:outline-none text-xs sm:text-sm"
                >
                  <option value="Amount">Amount</option>
                  <option value="%">%</option>
                </select>
              </div>
              <input
                type="text"
                name="Packaging_Note"
                placeholder="Note"
                value={values.Packaging_Note}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
          </div>

          <div className="mt-8 sm:mt-10 text-right flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 sm:gap-5">
            <span className="text-lg sm:text-2xl font-bold text-gray-700">
              ₹ Total Amount
            </span>
            <input
              type="number"
              value={calculateGrandTotal()}
              readOnly
              className="w-full sm:w-52 p-2.5 sm:p-3 bg-gray-50 border border-gray-200 rounded text-right text-[#2ecc71] font-bold text-xl sm:text-2xl"
            />
          </div>

          <div className="mt-4 text-right flex flex-col sm:flex-row items-end sm:items-center justify-end gap-3 sm:gap-5">
            <span className="text-md sm:text-lg font-semibold text-gray-500">
              (Incl. Total GST: ₹{calculateTotalGST().toFixed(2)})
            </span>
          </div>
        </div>

        {/* T&C Card */}
        <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.05)] p-8 mb-8">
          <div className="flex items-center justify-center gap-2.5 text-[#2ecc71] text-2xl font-semibold mb-8">
            <FaHandshake /> Terms & Conditions
          </div>

          <div className="flex flex-col gap-4 max-w-4xl mx-auto">
            <div className="flex flex-col sm:grid sm:grid-cols-[100px_1fr] sm:items-center gap-2 sm:gap-4">
              <label className="font-bold text-gray-600 text-sm sm:text-base">
                Tax
              </label>
              <input
                type="text"
                name="Term_Tax"
                value={values.Term_Tax}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-[100px_1fr] sm:items-center gap-2 sm:gap-4">
              <label className="font-bold text-gray-600 text-sm sm:text-base">
                Payment
              </label>
              <input
                type="text"
                name="Term_Payment"
                value={values.Term_Payment}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-[100px_1fr] sm:items-center gap-2 sm:gap-4">
              <label className="font-bold text-gray-600 text-sm sm:text-base">
                Delivery
              </label>
              <input
                type="text"
                name="Term_Delivery"
                value={values.Term_Delivery}
                onChange={handleInputChange}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col sm:grid sm:grid-cols-[100px_1fr] sm:items-start gap-2 sm:gap-4">
              <label className="font-bold text-gray-600 sm:mt-3 text-sm sm:text-base">
                Warranty
              </label>
              <textarea
                name="Term_Warranty"
                value={values.Term_Warranty}
                onChange={handleInputChange}
                className={`${inputClass} min-h-[100px]`}
              ></textarea>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-5 mt-10">
          <button
            onClick={() => handleSubmit("save")}
            className={`${btnBaseClass} bg-[#5d69eb] text-white flex-1 sm:flex-none min-w-[100px] sm:min-w-[120px]`}
          >
            <FaSave /> Save
          </button>
          <button
            onClick={() => handleSubmit("submit")}
            className={`${btnBaseClass} bg-[#6359b6] text-white flex-1 sm:flex-none min-w-[100px] sm:min-w-[120px]`}
          >
            <FaPaperPlane /> Submit
          </button>
          <button
            onClick={() => {
              const totals = {
                subtotal: calculateSubtotal(),
                totalGST: calculateTotalGST(),
                grandTotal: calculateGrandTotal(),
              };
              generateQuotationPDF(
                values,
                values.labEquipment,
                showFields,
                totals,
              );
            }}
            className={`${btnBaseClass} bg-[#1fb977] text-white w-full sm:w-auto mt-2 sm:mt-0`}
          >
            <FaFilePdf /> Generate PDF
          </button>
        </div>
      </div>
    </FormikProvider>
  );
};

export default QuotationForm;
