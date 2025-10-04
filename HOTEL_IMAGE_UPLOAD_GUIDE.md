# Hotel Image Upload API Usage

Now that we've implemented **Multer** for handling file uploads, here's how to use the hotel API endpoints:

## 🚀 **Updated API Usage**

### **1. Create Hotel Profile with Images**

**Endpoint:** `POST /api/hotels/profile`

**Content-Type:** `multipart/form-data`

**Form Fields:**

```javascript
// Hotel profile data
hotelName: "Grand Palace Hotel";
category: "RESORT";
totalRooms: 50;
amenities: ["wifi", "pool", "spa"];
cancellationPolicy: "Free cancellation up to 24 hours before check-in";
checkInTime: "14:00";
checkOutTime: "11:00";

// Image metadata
imageType: "property";
descriptions: ["Hotel lobby", "Pool area", "Restaurant"];
isPrimary: ["true", "false", "false"];

// Images (files)
images: [file1.jpg, file2.jpg, file3.jpg];
```

### **2. Update Hotel Profile with Images**

**Endpoint:** `PUT /api/hotels/profile`

**Content-Type:** `multipart/form-data`

**Form Fields:**

```javascript
// Update data
hotelName: "Updated Hotel Name";
amenities: ["wifi", "pool", "spa", "gym"];

// Image metadata
imageType: "room";
descriptions: "Deluxe room interior";
isPrimary: "false";

// Images (files)
images: [room1.jpg];
```

### **3. Upload Additional Images**

**Endpoint:** `POST /api/hotels/profile/images`

**Content-Type:** `multipart/form-data`

**Form Fields:**

```javascript
// Image metadata
imageType: "amenity";
descriptions: ["Gym equipment", "Spa room"];
isPrimary: ["false", "false"];

// Images (files)
images: [gym.jpg, spa.jpg];
```

## 📝 **Frontend Implementation Examples**

### **React/JavaScript Example:**

```javascript
// Create hotel profile with images
const createHotelProfile = async (hotelData, imageFiles) => {
  const formData = new FormData();

  // Add hotel data
  Object.keys(hotelData).forEach((key) => {
    if (Array.isArray(hotelData[key])) {
      hotelData[key].forEach((item) => formData.append(key, item));
    } else {
      formData.append(key, hotelData[key]);
    }
  });

  // Add images
  imageFiles.forEach((file, index) => {
    formData.append("images", file);
    formData.append("descriptions", `Image ${index + 1}`);
    formData.append("isPrimary", index === 0 ? "true" : "false");
  });

  const response = await fetch("/api/hotels/profile", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
};
```

### **HTML Form Example:**

```html
<form action="/api/hotels/profile" method="POST" enctype="multipart/form-data">
  <!-- Hotel Data -->
  <input type="text" name="hotelName" value="Grand Palace Hotel" required />
  <select name="category" required>
    <option value="RESORT">Resort</option>
    <option value="HOMESTAY">Homestay</option>
    <option value="HOUSEBOAT">Houseboat</option>
    <option value="GUESTHOUSE">Guesthouse</option>
  </select>
  <input type="number" name="totalRooms" value="50" required />
  <textarea name="cancellationPolicy" required>
Free cancellation up to 24 hours before check-in</textarea
  >
  <input type="time" name="checkInTime" value="14:00" required />
  <input type="time" name="checkOutTime" value="11:00" required />

  <!-- Image uploads -->
  <input type="file" name="images" multiple accept="image/*" required />
  <input
    type="text"
    name="descriptions"
    placeholder="Image descriptions (comma-separated)"
  />
  <select name="imageType">
    <option value="property">Property</option>
    <option value="room">Room</option>
    <option value="amenity">Amenity</option>
    <option value="food">Food</option>
  </select>

  <button type="submit">Create Hotel Profile</button>
</form>
```

## 🔧 **Technical Benefits of Multer Integration:**

✅ **Proper file handling** - No more base64 encoding
✅ **Memory efficient** - Streams files directly to ImageKit
✅ **File validation** - Automatic type and size checking
✅ **Better error handling** - Clear error messages for file issues
✅ **Production ready** - Standard multipart/form-data handling
✅ **Smaller payloads** - Direct binary upload vs base64

## 📊 **File Upload Limits:**

- **Maximum file size:** 5MB per image
- **Maximum files:** 10 images per request
- **Allowed formats:** JPEG, JPG, PNG, WebP
- **Automatic validation** and error responses

## 🎯 **Response Format:**

```json
{
  "success": true,
  "message": "Hotel profile created successfully",
  "data": {
    "id": "hotel_id",
    "hotelName": "Grand Palace Hotel",
    "category": "RESORT",
    "uploadedImages": [
      {
        "id": "image_id",
        "imageUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_id/image.jpg",
        "thumbnailUrl": "https://ik.imagekit.io/sojourn/hotels/vendor_id/tr:w-200,h-200/image.jpg",
        "description": "Hotel lobby",
        "isPrimary": true,
        "fileId": "imagekit_file_id"
      }
    ]
  }
}
```
