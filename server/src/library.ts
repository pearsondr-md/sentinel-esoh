export type ChecklistItem = { id: string; text: string };

export type Checklist = {
  id: string;
  title: string;
  shopName: string;
  items: ChecklistItem[];
};

export const CHECKLISTS: Checklist[] = [
  {
    id: "motor-pool",
    title: "Motor pool walk",
    shopName: "Shop 2",
    items: [
      { id: "solvent-label", text: "The parts-washer solvent container is labeled." },
      { id: "jack-stands", text: "A raised vehicle has jack stands under it." },
      { id: "eyewash", text: "The eyewash weekly flush is written on the tag." },
      { id: "waste-closed", text: "Waste containers are closed." },
    ],
  },
  {
    id: "wash-rack",
    title: "Wash rack walk",
    shopName: "Vehicle wash rack",
    items: [
      { id: "alarm", text: "The oil-water separator alarm was tested this month." },
      { id: "grate", text: "The exit grate is clear and has grit." },
      { id: "detergent", text: "Detergent drums are labeled." },
    ],
  },
  {
    id: "dining",
    title: "Dining facility walk",
    shopName: "Dining facility",
    items: [
      { id: "grease", text: "The grease-trap pump date is current." },
      { id: "floor", text: "The dish-machine floor is dry." },
      { id: "cylinder", text: "The carbon-dioxide cylinder is chained." },
    ],
  },
];

export type LibraryEntry = { id: string; kind: "chemical" | "job"; name: string; note: string };

export const LIBRARY: LibraryEntry[] = [
  { id: "chem-solvent", kind: "chemical", name: "Parts-washer solvent", note: "A name for the shop. A safety data sheet is not stored." },
  { id: "chem-brake", kind: "chemical", name: "Brake cleaner", note: "A name for the shop. A safety data sheet is not stored." },
  { id: "chem-diesel", kind: "chemical", name: "Diesel", note: "A name for the shop. A safety data sheet is not stored." },
  { id: "chem-detergent", kind: "chemical", name: "Wash-rack detergent", note: "A name for the shop. A safety data sheet is not stored." },
  { id: "job-lift", kind: "job", name: "Raise a vehicle", note: "A job step. The risk level still comes from the matrix." },
  { id: "job-wash", kind: "job", name: "Wash a vehicle", note: "A job step. The risk level still comes from the matrix." },
  { id: "job-fuel", kind: "job", name: "Receive fuel", note: "A job step. The risk level still comes from the matrix." },
  { id: "job-rack", kind: "job", name: "Pick from a storage rack", note: "A job step. The risk level still comes from the matrix." },
];
