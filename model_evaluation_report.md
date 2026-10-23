# Báo cáo chạy và đánh giá model

**Thời điểm chạy:** 2026-10-23  
**Model:** `best_model_v2.h5`  
**Nhãn:** `class_indices_v2.json`

## 1. Kết quả chạy

Model tải thành công và thực hiện inference không lỗi.

| Hạng mục | Giá trị |
|---|---:|
| TensorFlow | 2.21.0 |
| Python | 3.13.11 |
| Hệ điều hành | Windows 11 |
| Thiết bị | CPU (TensorFlow native Windows không dùng GPU) |
| Kích thước file model | 26,980,216 bytes (~25.73 MiB) |
| Keras format trong file | 3.14.1 |
| Tên model | `EyeStateCNN` |
| Kiểu dữ liệu | `float32` |
| Input | `(None, 64, 64, 1)` |
| Output | `(None, 3)` |
| Số layer đã load | 21 |
| Tổng số tham số | 2,239,331 |
| Tham số trainable | 2,238,179 |
| Tham số non-trainable | 1,152 |
| Loss lưu trong model | `categorical_crossentropy` |
| Metric lưu trong model | `accuracy` |
| Optimizer lưu trong model | Adam |
| Learning rate lưu trong model | `4.999999873689376e-05` |

## 2. Mapping lớp

| Index | Lớp |
|---:|---|
| 0 | `closed` |
| 1 | `open` |
| 2 | `yawn` |

## 3. Kiến trúc và số tham số theo layer

| # | Layer | Output shape | Parameters |
|---:|---|---|---:|
| 0 | Conv2D | `(None, 64, 64, 32)` | 320 |
| 1 | BatchNormalization | `(None, 64, 64, 32)` | 128 |
| 2 | Conv2D | `(None, 64, 64, 32)` | 9,248 |
| 3 | BatchNormalization | `(None, 64, 64, 32)` | 128 |
| 4 | MaxPooling2D | `(None, 32, 32, 32)` | 0 |
| 5 | Dropout | `(None, 32, 32, 32)` | 0 |
| 6 | Conv2D | `(None, 32, 32, 64)` | 18,496 |
| 7 | BatchNormalization | `(None, 32, 32, 64)` | 256 |
| 8 | Conv2D | `(None, 32, 32, 64)` | 36,928 |
| 9 | BatchNormalization | `(None, 32, 32, 64)` | 256 |
| 10 | MaxPooling2D | `(None, 16, 16, 64)` | 0 |
| 11 | Dropout | `(None, 16, 16, 64)` | 0 |
| 12 | Conv2D | `(None, 16, 16, 128)` | 73,856 |
| 13 | BatchNormalization | `(None, 16, 16, 128)` | 512 |
| 14 | MaxPooling2D | `(None, 8, 8, 128)` | 0 |
| 15 | Dropout | `(None, 8, 8, 128)` | 0 |
| 16 | Flatten | `(None, 8192)` | 0 |
| 17 | Dense | `(None, 256)` | 2,097,408 |
| 18 | BatchNormalization | `(None, 256)` | 1,024 |
| 19 | Dropout | `(None, 256)` | 0 |
| 20 | Dense/Softmax | `(None, 3)` | 771 |

## 4. Sanity inference

Các input dưới đây là input kiểm soát, **không phải ảnh có ground truth**. Vì vậy các kết quả này chỉ xác nhận pipeline preprocessing/inference hoạt động, không đại diện cho accuracy của model.

Input được tạo với shape `(1, 64, 64, 1)`, giá trị pixel đã ở khoảng `[0, 1]`.

| Input | `closed` | `open` | `yawn` | Dự đoán | Confidence | Entropy |
|---|---:|---:|---:|---|---:|---:|
| Ảnh đen toàn phần | 0.9998968840 | 0.0001016612 | 0.0000013914 | `closed` | 0.9998968840 | 0.0010565337 |
| Ảnh trắng toàn phần | 0.0006042704 | 0.9993957281 | 0.0000000000 | `open` | 0.9993957281 | 0.0050826324 |
| Xám 50% | 0.8226433992 | 0.1773566753 | 0.0000000000 | `closed` | 0.8226433992 | 0.4673614502 |
| Gradient ngang | 1.0000000000 | 0.0000000000 | 0.0000000000 | `closed` | 1.0000000000 | 0.0000000000 |
| Random seed 42 | 0.0000000000 | 1.0000000000 | 0.0000000000 | `open` | 1.0000000000 | 0.0000000000 |

Các giá trị rất nhỏ được hiển thị thành `0.0000000000` do làm tròn; softmax vẫn trả về vector 3 phần tử có tổng xấp xỉ 1.

## 5. Metric đánh giá có ground truth

Chưa thể tính các metric sau trong lần chạy này:

- Accuracy
- Precision, recall, F1 theo từng lớp
- Macro/weighted F1
- Confusion matrix
- Validation loss

Lý do: repository hiện không chứa `dataset/`, `dataset.zip`, hoặc thư mục ảnh test/validation có nhãn. Script [train_cnn.py](./train_cnn.py) yêu cầu cấu trúc `dataset/closed`, `dataset/open`, `dataset/yawn` và dùng validation split 20%; không có dữ liệu này thì việc chạy `model.evaluate()` sẽ không có cơ sở đo lường.

Không sử dụng các input tổng hợp ở mục 4 để suy ra accuracy hoặc chất lượng nhận diện thực tế.

## 6. Cách chạy đánh giá đầy đủ khi có dataset

Đặt dữ liệu theo cấu trúc:

```text
dataset/
  closed/
  open/
  yawn/
```

Sau đó chạy:

```powershell
python train_cnn.py `
  --dataset dataset `
  --resume best_model_v2.h5 `
  --epochs 1 `
  --out-model evaluation_model.h5 `
  --out-history evaluation_history.png `
  --out-cm evaluation_confusion_matrix.png
```

Lưu ý: script hiện tại vừa fine-tune vừa đánh giá. Để đánh giá độc lập model mà không ghi đè/huấn luyện lại, cần một evaluator riêng dùng `flow_from_directory(..., shuffle=False)` và `model.evaluate()`/`classification_report()` trên tập test hoặc validation cố định.
