import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
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
} from "react-icons/fa";
import { fetchCustomers } from "../store/slices/customerSlice";
import { fetchItems } from "../store/slices/itemSlice";
import { createSave } from "../store/slices/saveSlice";
import { createResponse } from "../store/slices/responseSlice";
import CustomerModal from "./CustomerModal";

const QuotationForm = () => {
  const dispatch = useDispatch();
  const { customers } = useSelector((state) => state.customer);
  const { items: masterItems } = useSelector((state) => state.item);

  const [formData, setFormData] = useState({
    Date: new Date().toISOString().split("T")[0],
    Quotation_No: "",
    Customer_Name: "",
    Buyer_Address: "",
    Delivery_Address: "",
    GSTIN_UIN: "",
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
  });

  const [labEquipment, setLabEquipment] = useState([
    {
      id: 1,
      item_name: "",
      specifications: "",
      qty: 1,
      unit_price: 0,
      total_price: 0,
      image: null,
      hsn: "",
      nabl: false,
      make: "",
      discount_percent: 0,
    },
  ]);

  const [showFields, setShowFields] = useState({
    hsn: false,
    nabl: false,
    make: false,
    discount: false,
  });

  useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchItems());
  }, [dispatch]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === "Customer_Name") {
        const selectedCustomer = customers.find(
          (c) => (c.Customer_Name || c.CUSTOMER_NAME) === value,
        );
        if (selectedCustomer) {
          updated.Buyer_Address = selectedCustomer.Buyer_Address || "";
          updated.Delivery_Address = selectedCustomer.Delivery_Address || "";
          updated.GSTIN_UIN = selectedCustomer.GSTIN_UIN || "";
          updated.Contact_Person = selectedCustomer.Contact_Person || "";
          updated.Email_Address = selectedCustomer.Email_Address || "";
          updated.Contact_Mobile = selectedCustomer.Contact_Mobile || "";
        }
      }

      return updated;
    });
  };

  const handleEquipmentChange = (index, field, value) => {
    const updated = [...labEquipment];
    updated[index][field] = value;

    if (field === "item_name") {
      const selectedItem = masterItems.find((item) => item.ITEM_NAME === value);
      if (selectedItem) {
        updated[index].specifications = selectedItem.SPECIFICATIONS || "";
        const priceStr = selectedItem.UNIT_PRICE || "0";
        updated[index].unit_price = parseFloat(priceStr.replace(/,/g, "")) || 0;
        updated[index].hsn = selectedItem.HSN_CODE || "";
        updated[index].make = selectedItem.MAKE || "";
        updated[index].nabl = !!selectedItem.NABL;
      }
    }

    if (
      field === "qty" ||
      field === "unit_price" ||
      field === "discount_percent" ||
      field === "item_name"
    ) {
      const qty = updated[index].qty || 0;
      const price = updated[index].unit_price || 0;
      const disc = updated[index].discount_percent || 0;
      updated[index].total_price = qty * price * (1 - disc / 100);
    }
    setLabEquipment(updated);
  };

  const addMoreEquipment = () => {
    setLabEquipment([
      ...labEquipment,
      {
        id: Date.now(),
        item_name: "",
        specifications: "",
        qty: 1,
        unit_price: 0,
        total_price: 0,
        image: null,
        hsn: "",
        nabl: false,
        make: "",
        discount_percent: 0,
      },
    ]);
  };

  const removeEquipment = (index) => {
    if (labEquipment.length > 1) {
      setLabEquipment(labEquipment.filter((_, i) => i !== index));
    }
  };

  const calculateSubtotal = () => {
    return labEquipment.reduce((sum, item) => sum + item.total_price, 0);
  };

  const calculateGrandTotal = () => {
    const subtotal = calculateSubtotal();
    let total = subtotal;

    // Discount
    if (formData.DiscountType === "%") {
      total -= subtotal * (formData.Discount / 100);
    } else {
      total -= formData.Discount;
    }

    // Freight
    total += Number(formData.Freight_Charges);

    // Packaging
    total += Number(formData.Packaging_Charges);

    return total;
  };

  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const handleSubmit = (actionType) => {
    const data = new FormData();
    Object.keys(formData).forEach((key) => data.append(key, formData[key]));
    data.append("ITEMS", JSON.stringify(labEquipment));
    data.append("Subtotal", calculateSubtotal());
    data.append("Total_Amount", calculateGrandTotal());

    // Append images
    labEquipment.forEach((item) => {
      if (item.image) {
        data.append("Image_URL", item.image);
      }
    });

    if (actionType === "save") {
      dispatch(createSave(data));
    } else if (actionType === "submit") {
      dispatch(createResponse(data));
    }
  };

  const inputClass =
    "p-2.5 px-4 border border-gray-200 rounded-md text-base bg-white transition-colors focus:outline-none focus:border-[#2ecc71] w-full";
  const labelClass =
    "flex items-center gap-2.5 font-semibold text-gray-700 whitespace-nowrap";
  const rowGroupClass = "grid grid-cols-[140px_1fr] items-center gap-4";
  const btnBaseClass =
    "px-5 py-2.5 rounded-md font-semibold cursor-pointer flex items-center gap-2 transition-all text-sm hover:opacity-90 hover:-translate-y-0.5 shadow-sm";

  return (
    <div className="max-w-[1200px] mx-auto my-5 px-5 font-sans text-gray-800 relative">
      <CustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(name) => {
          setFormData((prev) => ({ ...prev, Customer_Name: name }));
          setIsCustomerModalOpen(false);
        }}
      />
      {/* Quotation Details Card */}
      <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.05)] p-8 mb-8">
        <div className="flex items-center justify-center gap-4 mb-10 pb-5 border-b border-gray-100">
          <FaFileAlt size={35} className="text-gray-700" />
          <h1 className="text-4xl tracking-tight text-gray-800 uppercase font-bold">
            ASEW QUOTATION FORM
          </h1>
        </div>

        <div className="flex items-center justify-center gap-2.5 text-[#2ecc71] text-2xl font-semibold mb-8">
          <FaInfoCircle /> Quotation Details
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
          <div className={rowGroupClass}>
            <label className={labelClass}>
              <FaCalendarAlt className="text-gray-500" /> Date
            </label>
            <input
              type="date"
              name="Date"
              value={formData.Date}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>

          <div className={rowGroupClass}>
            <label className={labelClass}>
              <FaHashtag className="text-gray-500" /> Quotation No.
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                name="Quotation_No"
                value={formData.Quotation_No}
                onChange={handleInputChange}
                placeholder="Enter or Generate"
                className={inputClass}
              />
              <button
                className={`${btnBaseClass} bg-[#f39c12] text-white px-3 py-1.5`}
              >
                <FaCopy /> Copy Old
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[140px_1fr] items-center gap-4 md:col-span-2">
            <label className={labelClass}>
              <FaUser className="text-gray-500" /> Customer Name
            </label>
            <div className="flex gap-2">
              <select
                name="Customer_Name"
                value={formData.Customer_Name}
                onChange={handleInputChange}
                className={`${inputClass} flex-1`}
              >
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option
                    key={c.id || c.Customer_Name || c.CUSTOMER_NAME}
                    value={c.Customer_Name || c.CUSTOMER_NAME}
                  >
                    {c.Customer_Name || c.CUSTOMER_NAME}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className={`${btnBaseClass} border border-[#3498db] text-[#3498db] bg-transparent px-3 py-1.5 whitespace-nowrap`}
              >
                <FaPlus /> Add Customer
              </button>
            </div>
          </div>

          <div className={rowGroupClass}>
            <label className={labelClass}>Buyer Address</label>
            <textarea
              name="Buyer_Address"
              value={formData.Buyer_Address}
              onChange={handleInputChange}
              placeholder="Full address of buyer"
              className={`${inputClass} min-h-[80px]`}
            ></textarea>
          </div>

          <div className={rowGroupClass}>
            <label className={labelClass}>Delivery Address</label>
            <textarea
              name="Delivery_Address"
              value={formData.Delivery_Address}
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
              value={formData.GSTIN_UIN}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>

          <div className={rowGroupClass}>
            <label className={labelClass}>Contact Person</label>
            <input
              type="text"
              name="Contact_Person"
              value={formData.Contact_Person}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>

          <div className={rowGroupClass}>
            <label className={labelClass}>Email Address</label>
            <input
              type="email"
              name="Email_Address"
              value={formData.Email_Address}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>

          <div className={rowGroupClass}>
            <label className={labelClass}>Contact Mobile</label>
            <input
              type="text"
              name="Contact_Mobile"
              value={formData.Contact_Mobile}
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

        <div className="flex justify-end gap-6 mb-6">
          {["hsn", "nabl", "make", "discount"].map((field) => (
            <label
              key={field}
              className="flex items-center gap-2.5 text-sm text-gray-600 cursor-pointer"
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
                className="w-4 h-4"
              />
              Show {field.toUpperCase()}
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
              {labEquipment.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-2 border border-gray-200 text-center">
                    {index + 1}
                  </td>
                  <td className="p-2 border border-gray-200">
                    <select
                      value={item.item_name}
                      onChange={(e) =>
                        handleEquipmentChange(
                          index,
                          "item_name",
                          e.target.value,
                        )
                      }
                      className="w-full p-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-[#2ecc71]"
                    >
                      <option value="">Select Item</option>
                      {masterItems.map((mi) => (
                        <option
                          key={mi.id || mi.ITEM_NAME}
                          value={mi.ITEM_NAME}
                        >
                          {mi.ITEM_NAME}
                        </option>
                      ))}
                    </select>
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
                    <td className="p-2 border border-gray-200 text-center">
                      <input
                        type="checkbox"
                        checked={item.nabl}
                        onChange={(e) =>
                          handleEquipmentChange(index, "nabl", e.target.checked)
                        }
                        className="w-4 h-4 mt-1"
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
                      className="w-full p-2 border border-gray-200 rounded text-sm text-center"
                    />
                  </td>
                  <td className="p-2 border border-gray-200">
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
                      className="w-full p-2 border border-gray-200 rounded text-sm text-right"
                    />
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
                        handleEquipmentChange(index, "image", e.target.files[0])
                      }
                      className="text-xs"
                    />
                  </td>
                  <td className="p-2 border border-gray-200 text-center">
                    <button
                      onClick={() => removeEquipment(index)}
                      className="bg-red-500 text-white p-2.5 rounded hover:bg-red-600 transition-colors"
                    >
                      <FaTrash />
                    </button>
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
                  {labEquipment.reduce((sum, item) => sum + item.qty, 0)}
                </td>
                <td className="text-center">-</td>
                {showFields.discount && <td className="text-center">-</td>}
                <td className="text-center text-[#2ecc71]">
                  {calculateSubtotal()}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-3">
            <div className="font-semibold text-gray-700">% Discount</div>
            <div className="flex border border-gray-200 rounded-md overflow-hidden">
              <input
                type="number"
                name="Discount"
                value={formData.Discount}
                onChange={handleInputChange}
                className="flex-1 p-2 focus:outline-none px-4"
              />
              <select
                name="DiscountType"
                value={formData.DiscountType}
                onChange={handleInputChange}
                className="border-l border-gray-200 bg-gray-50 p-2 focus:outline-none"
              >
                <option value="%">%</option>
                <option value="Amount">Amount</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 font-semibold text-gray-700">
              <FaPaperPlane className="text-gray-500" /> Freight Charges
            </div>
            <div className="flex border border-gray-200 rounded-md overflow-hidden">
              <input
                type="number"
                name="Freight_Charges"
                value={formData.Freight_Charges}
                onChange={handleInputChange}
                className="flex-1 p-2 focus:outline-none px-4"
              />
              <select
                name="FreightType"
                value={formData.FreightType}
                onChange={handleInputChange}
                className="border-l border-gray-200 bg-gray-50 p-2 focus:outline-none"
              >
                <option value="Amount">Amount</option>
                <option value="%">%</option>
              </select>
            </div>
            <input
              type="text"
              name="Freight_Note"
              placeholder="Note (e.g. To Pay)"
              value={formData.Freight_Note}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="font-semibold text-gray-700">Packaging Charges</div>
            <div className="flex border border-gray-200 rounded-md overflow-hidden">
              <input
                type="number"
                name="Packaging_Charges"
                value={formData.Packaging_Charges}
                onChange={handleInputChange}
                className="flex-1 p-2 focus:outline-none px-4"
              />
              <select
                name="PackagingType"
                value={formData.PackagingType}
                onChange={handleInputChange}
                className="border-l border-gray-200 bg-gray-50 p-2 focus:outline-none"
              >
                <option value="Amount">Amount</option>
                <option value="%">%</option>
              </select>
            </div>
            <input
              type="text"
              name="Packaging_Note"
              placeholder="Note"
              value={formData.Packaging_Note}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-10 text-right text-2xl font-bold flex items-center justify-end gap-5">
          <span>₹ Total Amount</span>
          <input
            type="number"
            value={calculateGrandTotal()}
            readOnly
            className="w-52 p-3 bg-gray-50 border border-gray-200 rounded text-right text-[#2ecc71]"
          />
        </div>
      </div>

      {/* T&C Card */}
      <div className="bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.05)] p-8 mb-8">
        <div className="flex items-center justify-center gap-2.5 text-[#2ecc71] text-2xl font-semibold mb-8">
          <FaHandshake /> Terms & Conditions
        </div>

        <div className="flex flex-col gap-4 max-w-4xl mx-auto">
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <label className="font-bold text-gray-600">Tax</label>
            <input
              type="text"
              name="Term_Tax"
              value={formData.Term_Tax}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <label className="font-bold text-gray-600">Payment</label>
            <input
              type="text"
              name="Term_Payment"
              value={formData.Term_Payment}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-[100px_1fr] items-center gap-4">
            <label className="font-bold text-gray-600">Delivery</label>
            <input
              type="text"
              name="Term_Delivery"
              value={formData.Term_Delivery}
              onChange={handleInputChange}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-[100px_1fr] items-start gap-4">
            <label className="font-bold text-gray-600 mt-3">Warranty</label>
            <textarea
              name="Term_Warranty"
              value={formData.Term_Warranty}
              onChange={handleInputChange}
              className={`${inputClass} min-h-[100px]`}
            ></textarea>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-center gap-5 mt-10">
        <button
          onClick={() => handleSubmit("save")}
          className={`${btnBaseClass} bg-[#5d69eb] text-white scale-110`}
        >
          <FaSave /> Save
        </button>
        <button
          onClick={() => handleSubmit("submit")}
          className={`${btnBaseClass} bg-[#6359b6] text-white scale-110`}
        >
          <FaPaperPlane /> Submit
        </button>
        <button className={`${btnBaseClass} bg-[#1fb977] text-white scale-110`}>
          <FaFilePdf /> Generate PDF
        </button>
      </div>
    </div>
  );
};

export default QuotationForm;
