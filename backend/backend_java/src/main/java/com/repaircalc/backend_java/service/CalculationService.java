package com.repaircalc.backend_java.service;

import com.repaircalc.backend_java.dto.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.*;

@Service
public class CalculationService {
    private final DataService data;
    public CalculationService(DataService data) { this.data = data; }
    public EstimateDto calculateEstimate(ProjectDto project) {
        if (project == null || project.rooms() == null || project.rooms().isEmpty() || project.rooms().size()>100 ||
                blank(project.id()) || blank(project.name()) || blank(project.updatedAt()) || project.object()==null ||
                !List.of("Квартира","Дом","Студия").contains(project.object()) || project.repair()==null ||
                !List.of(5,10,15).contains(project.reserve()) || !List.of("Косметический","Капитальный","Дизайнерский").contains(project.repair()) ||
                project.rooms().stream().filter(Objects::nonNull).map(RoomDto::id).distinct().count()!=project.rooms().size())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Некорректный проект");
        var catalog = data.getProducts();
        Map<String,ProductDto> byId = new HashMap<>(); catalog.forEach(p->byId.put(p.id(),p));
        Map<String,EstimateItemDto> rows = new LinkedHashMap<>();
        Set<String> warnings = new LinkedHashSet<>();
        for (RoomDto room:project.rooms()) {
            validateRoom(room);
            double floor=room.length()*room.width();
            double wall=Math.max(0,2*(room.length()+room.width())*room.height()-room.windows()*2.1-room.doors()*1.6);
            add(rows,selected(byId,room.floor(),"floor",room),floor,project.reserve(),room.name());
            add(rows,selected(byId,room.wall(),"walls",room),wall,project.reserve(),room.name());
            // Existing calculation scope: include available, evidenced preparation products.
            accessory(catalog,"can",room).ifPresent(p->add(rows,p,wall,project.reserve(),room.name()));
            if (accessory(catalog,"can",room).isEmpty()) warnings.add("Грунтовка не включена: в каталоге нет подходящей карточки с подтверждённой нормой расхода.");
            if (!"Косметический".equals(project.repair())) {
                accessory(catalog,"bag",room).ifPresent(p->add(rows,p,wall,project.reserve(),room.name()));
                accessory(catalog,"socket",room).ifPresent(p->add(rows,p,Math.max(2,Math.ceil(floor/4)),0,room.name()));
                if (accessory(catalog,"bag",room).isEmpty()) warnings.add("Штукатурка не включена: требуется уточнить подходящий материал и расход.");
                if (accessory(catalog,"socket",room).isEmpty()) warnings.add("Розетки не включены: нет подходящих характеристик для комнаты.");
            }
        }
        var items=new ArrayList<>(rows.values());
        BigDecimal materials=items.stream().map(EstimateItemDto::cost).reduce(BigDecimal.ZERO,BigDecimal::add);
        double area=project.rooms().stream().mapToDouble(r->r.length()*r.width()).sum();
        int rate="Косметический".equals(project.repair())?900:"Дизайнерский".equals(project.repair())?2800:1800;
        BigDecimal labor=project.labor()?BigDecimal.valueOf(Math.round(area*rate)):BigDecimal.ZERO;
        return new EstimateDto(items,materials,labor,materials.add(labor),area,List.of(
            total("floor","Напольные покрытия","#bd7853",items),total("walls","Отделка стен","#83917c",items),
            total("prep","Подготовка поверхностей","#c4bba6",items),total("electric","Электрика","#697f88",items)),List.copyOf(warnings));
    }
    private static boolean blank(String value) { return value==null || value.isBlank(); }
    public static void validateRoom(RoomDto room) {
        if (room == null || blank(room.id()) || blank(room.name()) || blank(room.floor()) || blank(room.wall()) ||
                room.type()==null || !List.of("living","kitchen","bathroom","bedroom","kids","balcony").contains(room.type()) ||
                !Double.isFinite(room.length()) || !Double.isFinite(room.width()) || !Double.isFinite(room.height()) ||
                room.length()<0.5 || room.length()>30 || room.width()<0.5 || room.width()>30 || room.height()<2 || room.height()>6 ||
                room.windows()<0 || room.windows()>10 || room.doors()<0 || room.doors()>10)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Некорректные параметры комнаты");
    }
    private Optional<ProductDto> accessory(List<ProductDto> catalog,String texture,RoomDto room) {
        return catalog.stream().filter(p->p.texture().equals(texture)&&(!room.wet()||p.wet())).findFirst();
    }
    private ProductDto selected(Map<String,ProductDto> catalog,String id,String category,RoomDto room) {
        var p=catalog.get(id);
        if(p==null || !p.category().equals(category) || (room.wet()&&!p.wet()) || (room.heavy()&&!p.heavy()))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,"Выбранный материал отсутствует или не подходит комнате");
        return p;
    }
    private void add(Map<String,EstimateItemDto> rows,ProductDto p,double surface,int reserve,String room) {
        int quantity=ProductService.quantity(p,surface,reserve);
        var existing=rows.get(p.id());
        List<String> rooms=new ArrayList<>(); rooms.add(room);
        if(existing!=null) { quantity=Math.addExact(quantity,existing.quantity());surface+=existing.surface();rooms.addAll(existing.rooms()); }
        rows.put(p.id(),new EstimateItemDto(p,quantity,p.price().multiply(BigDecimal.valueOf(quantity)),rooms,surface));
    }
    private CategoryTotalDto total(String id,String name,String color,List<EstimateItemDto> items) {
        return new CategoryTotalDto(id,name,color,items.stream().filter(i->i.product().category().equals(id)).map(EstimateItemDto::cost).reduce(BigDecimal.ZERO,BigDecimal::add));
    }
}
