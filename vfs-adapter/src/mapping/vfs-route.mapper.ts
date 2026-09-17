export interface VfsRouteSelectionCriteria {
  centre: string;
  category: string;
  subcategory: string;
}

export function mapRouteToSelection(route: {
  applicationCentre: string;
  visaCategory: string;
  visaSubcategory: string;
}): VfsRouteSelectionCriteria {
  return {
    centre: route.applicationCentre.trim(),
    category: route.visaCategory.trim(),
    subcategory: route.visaSubcategory.trim(),
  };
}
