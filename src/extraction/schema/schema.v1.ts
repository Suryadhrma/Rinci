import { z } from 'zod';

const menuItemSchema = z.object({
  nm: z.string().nullish(),
  cnt: z.string().nullish(),
  price: z.string().nullish(),
  unitprice: z.string().nullish(),
});

// Sampel asli CORD kadang mengembalikan "menu" sebagai objek tunggal
// (struk isi 1 item), bukan array — dinormalisasi di sini supaya
// konsumen skema ini selalu dapat array, tidak perlu cek dua bentuk.
const menuSchema = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (val == null) return [];
  return [val];
}, z.array(menuItemSchema));

const subTotalSchema = z
  .object({
    subtotal_price: z.string().nullish(),
    tax_price: z.string().nullish(),
    service_price: z.string().nullish(),
  })
  .nullish();

const totalSchema = z
  .object({
    total_price: z.string().nullish(),
    cashprice: z.string().nullish(),
    changeprice: z.string().nullish(),
  })
  .nullish();

export const receiptSchemaV1 = z.object({
  menu: menuSchema,
  sub_total: subTotalSchema,
  total: totalSchema,
});

export type ReceiptV1 = z.infer<typeof receiptSchemaV1>;
